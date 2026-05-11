import json
import os
import time
import math
import html
from datetime import datetime
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from datasets import Dataset

from ragas import evaluate
from ragas.metrics import faithfulness, context_precision, answer_correctness
from ragas.metrics import AnswerRelevancy

# Groq 'n > 1' parametresini desteklemediğinden strictness=1 zorunlu.
# Varsayılan strictness=3 olduğunda "n must be at most 1" hatası alınır.
answer_relevancy = AnswerRelevancy(strictness=1)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.run_config import RunConfig

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BACKEND_URL    = os.getenv("BACKEND_URL", "http://localhost:8000")
EVAL_TOKEN     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZDliNWU3ZS05ZWQ3LTQwYWYtYjRlYy01Y2QyODcwNjlmZTAiLCJleHAiOjE3Nzg0ODc1ODEsInR5cGUiOiJhY2Nlc3MifQ.3mGKfBBrVCsSmFEp4C7U82ky_Ukz47K8okwZZwaiLjA"
GROQ_API_KEY   = "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"
GROQ_MODEL     = os.getenv("GROQ_EVAL_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
EMBED_MODEL    = "BAAI/bge-m3"

_HERE                  = Path(__file__).parent
DATASET_PATH           = _HERE / "dataset.json"
CHECKPOINT_PATH        = _HERE / "results" / "checkpoint.json"
RAGAS_CHECKPOINT_PATH  = _HERE / "results" / "ragas_checkpoint.json"  # YENİ
REPORT_DIR             = _HERE / "results"

REQUEST_DELAY  = 10   # saniye (rate limit koruması)
HTTP_TIMEOUT   = 90   # saniye
RAGAS_DELAY    = 15   # saniye — her soru arası bekleme (Groq rate limit için)

# ─────────────────────────────────────────────
# HELPERS — Dataset & Checkpoint
# ─────────────────────────────────────────────

def load_dataset(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for idx, item in enumerate(data):
        if "id" not in item:
            item["id"] = f"Q-{idx+1:03d}"
    return data


def load_checkpoint() -> list[dict]:
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_checkpoint(data: list[dict]) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
# HELPERS — Ragas Checkpoint (YENİ)
# ─────────────────────────────────────────────

def load_ragas_checkpoint() -> list[dict]:
    """Daha önce değerlendirilen soruların Ragas sonuçlarını yükler."""
    if RAGAS_CHECKPOINT_PATH.exists():
        with open(RAGAS_CHECKPOINT_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_ragas_checkpoint(data: list[dict]) -> None:
    """Ragas sonuçlarını diske kaydeder."""
    RAGAS_CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RAGAS_CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
# HELPERS — Backend API
# ─────────────────────────────────────────────

def ask_agent(question: str) -> tuple[str, list[str]]:
    headers = {"Authorization": f"Bearer {EVAL_TOKEN}"}

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.post(
            f"{BACKEND_URL}/api/chat",
            json={"query": question, "conversation_id": None},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    answer = data.get("answer") or data.get("content") or data.get("message") or ""

    raw_sources = data.get("sources") or []
    contexts = []
    for src in raw_sources:
        if isinstance(src, dict):
            text = src.get("content") or src.get("text") or src.get("snippet")
            if not text:
                text = str(src)
            contexts.append(text)
        else:
            contexts.append(str(src))

    if not contexts:
        contexts = [""]

    return answer, contexts


# ─────────────────────────────────────────────
# PHASE 1 — Collect answers with checkpoint
# ─────────────────────────────────────────────

def collect_answers(raw_data: list[dict]) -> list[dict]:
    processed = load_checkpoint()
    done_ids  = {item["id"] for item in processed}

    remaining = [q for q in raw_data if q["id"] not in done_ids]
    print(f"  Toplam: {len(raw_data)}  |  İşlenmiş: {len(done_ids)}  |  Kalan: {len(remaining)}\n")

    for idx, item in enumerate(raw_data):
        if item["id"] in done_ids:
            continue

        q_id = item["id"]
        print(f"  [{idx+1}/{len(raw_data)}] {q_id}: {item['question'][:60]}...")

        try:
            answer, contexts = ask_agent(item["question"])
            processed.append({
                "id":            q_id,
                "question":      item["question"],
                "answer":        answer,
                "contexts":      contexts,
                "ground_truth":  item["ground_truth"],
                "question_type": item.get("question_type", "Genel"),
            })
            save_checkpoint(processed)
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            print(f"\n  HATA ({q_id}): {e}")
            print("  Checkpoint kaydedildi. Script'i yeniden çalıştırarak devam edebilirsiniz.")
            raise SystemExit(1)

    return processed


# ─────────────────────────────────────────────
# PHASE 2 — Ragas evaluation (checkpoint'li)
# ─────────────────────────────────────────────

def run_ragas(processed: list[dict]) -> pd.DataFrame:
    """
    Her soruyu teker teker değerlendirir ve sonucu ragas_checkpoint.json'a kaydeder.
    Script kesilirse, kaldığı yerden devam eder.
    """
    llm = LangchainLLMWrapper(
        ChatGroq(api_key=GROQ_API_KEY, model_name=GROQ_MODEL, temperature=0)
    )
    emb = LangchainEmbeddingsWrapper(
        HuggingFaceEmbeddings(
            model_name=EMBED_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    )
    custom_run_config = RunConfig(max_workers=1, max_retries=5)

    # Daha önce değerlendirilmiş soruları yükle
    ragas_results = load_ragas_checkpoint()
    done_ids      = {r["id"] for r in ragas_results}

    remaining = [item for item in processed if item["id"] not in done_ids]
    total     = len(processed)

    print(f"  Ragas checkpoint: {len(done_ids)}/{total} soru zaten değerlendirilmiş.")
    print(f"  Kalan: {len(remaining)} soru\n")

    METRIC_COLS = ["faithfulness", "answer_relevancy", "context_precision", "answer_correctness"]

    for idx, item in enumerate(remaining):
        q_id = item["id"]
        global_idx = list(processed).index(item) + 1
        print(f"  [{global_idx}/{total}] {q_id}: {item['question'][:55]}...", end=" ", flush=True)

        # Tek satırlık dataset oluştur
        single_row = Dataset.from_dict({
            "question":     [item["question"]],
            "answer":       [item["answer"]],
            "contexts":     [item["contexts"]],
            "ground_truth": [item["ground_truth"]],
        })

        try:
            result = evaluate(
                dataset=single_row,
                metrics=[faithfulness, answer_relevancy, context_precision, answer_correctness],
                llm=llm,
                embeddings=emb,
                run_config=custom_run_config,
                raise_exceptions=False,
            )
            row_df = result.to_pandas()

            # Metrik değerlerini çıkar
            scores = {
                col: float(row_df[col].iloc[0]) if col in row_df.columns else float("nan")
                for col in METRIC_COLS
            }

            # ── Post-processing ──────────────────────────────────────────
            # Bağlam yoksa (Out-of-Scope veya boş context) faithfulness ve
            # context_precision anlamsızdır — 0 değil nan (N/A) olarak işaretle.
            # Bu metrikler bu soruların ortalamalarına dahil edilmez.
            ctx = item.get("contexts", [])
            context_is_empty = (not ctx) or (ctx == [""]) or all(not c.strip() for c in ctx)
            q_type = item.get("question_type", "Genel")

            if context_is_empty or q_type == "Out-of-Scope":
                scores["faithfulness"]      = float("nan")   # N/A: bağlam yok
                scores["context_precision"] = float("nan")   # N/A: bağlam yok

            # Sonucu ragas checkpoint'ine ekle
            ragas_results.append({
                "id":            q_id,
                "question":      item["question"],
                "answer":        item["answer"],
                "ground_truth":  item["ground_truth"],
                "question_type": item.get("question_type", "Genel"),
                **scores,
            })
            save_ragas_checkpoint(ragas_results)

            score_str = "  ".join(f"{k[:4]}={'N/A' if math.isnan(v) else f'{v:.2f}'}" for k, v in scores.items())
            print(f"✓  {score_str}")

        except Exception as e:
            print(f"\n  HATA ({q_id}): {e}")
            print(f"  {len(ragas_results)}/{total} soru kaydedildi.")
            print("  Script'i yeniden çalıştırarak kaldığı yerden devam edebilirsiniz.")
            raise SystemExit(1)

        # Son soru değilse bekle
        if idx < len(remaining) - 1:
            time.sleep(RAGAS_DELAY)

    print(f"\n  ✓ Tüm sorular değerlendirildi ({total}/{total})")

    # Tüm sonuçları DataFrame'e çevir
    df = pd.DataFrame(ragas_results)
    return df


# ─────────────────────────────────────────────
# PHASE 3 — HTML Report
# ─────────────────────────────────────────────

METRIC_COLS = ["faithfulness", "answer_relevancy", "context_precision", "answer_correctness"]
METRIC_LABELS = {
    "faithfulness":        "Sadakat",
    "answer_relevancy":    "Yanıt Alaka",
    "context_precision":   "Bağlam Hassas.",
    "answer_correctness":  "Yanıt Doğruluk",
}
METRIC_DESCS = {
    "faithfulness":       "Cevabın, sağlanan bağlama ne kadar sadık olduğu.",
    "answer_relevancy":   "Cevabın soruyla ne kadar alakalı olduğu.",
    "context_precision":  "Bağlamdaki bilgilerin ne kadarının gerçekten kullanıldığı.",
    "answer_correctness": "Cevabın ground-truth ile ne kadar örtüştüğü.",
}


def score_color(v: float) -> str:
    if v >= 0.75: return "#22c55e"
    if v >= 0.50: return "#f59e0b"
    return "#ef4444"


def score_grade(v: float) -> str:
    if v >= 0.85: return "Mükemmel"
    if v >= 0.70: return "İyi"
    if v >= 0.50: return "Orta"
    return "Zayıf"


def fmt_score(v: float) -> str:
    """nan → N/A, aksi hâlde 3 ondalık."""
    if math.isnan(v):
        return "N/A"
    return f"{v:.3f}"


def fmt_score_short(v: float) -> str:
    """nan → N/A, aksi hâlde 2 ondalık."""
    if math.isnan(v):
        return "N/A"
    return f"{v:.2f}"


def score_color_safe(v: float) -> str:
    """nan için nötr gri, aksi hâlde renkli."""
    if math.isnan(v):
        return "#475569"
    return score_color(v)


def sparkline_path(values: list[float], w=120, h=32) -> str:
    vals = [v for v in values if not math.isnan(v)]
    if len(vals) < 2:
        return ""
    mn, mx = min(vals), max(vals)
    rng = mx - mn or 0.0001
    pts = []
    for i, v in enumerate(vals):
        x = i / (len(vals) - 1) * w
        y = h - (v - mn) / rng * h
        pts.append(f"{x:.1f},{y:.1f}")
    return " ".join(pts)


def radar_polygon(scores: dict[str, float], cx=150, cy=150, r=100) -> str:
    keys = list(scores.keys())
    n = len(keys)
    pts = []
    for i, k in enumerate(keys):
        angle = math.radians(90 + 360 / n * i)
        rv = scores[k] * r
        x = cx - math.cos(angle) * rv
        y = cy - math.sin(angle) * rv
        pts.append(f"{x:.1f},{y:.1f}")
    return " ".join(pts)


def radar_label_pos(i: int, n: int, cx=150, cy=150, r=120) -> tuple[float, float]:
    angle = math.radians(90 + 360 / n * i)
    return cx - math.cos(angle) * r, cy - math.sin(angle) * r


def build_html_report(df: pd.DataFrame, generated_at: str) -> str:
    existing = [c for c in METRIC_COLS if c in df.columns]
    # nanmean: nan (N/A) değerleri ortalamadan hariç tutulur
    means    = {c: float(np.nanmean(df[c].astype(float))) for c in existing}
    overall  = float(np.nanmean(list(means.values()))) if means else 0.0

    type_stats: dict[str, dict] = {}
    if "question_type" in df.columns:
        for qt, grp in df.groupby("question_type"):
            type_stats[str(qt)] = {c: float(np.nanmean(grp[c].astype(float))) for c in existing}

    n = len(existing)
    rad_pts  = radar_polygon({c: means[c] for c in existing})
    axis_lines = ""
    axis_labels = ""
    for i, c in enumerate(existing):
        angle = math.radians(90 + 360 / n * i)
        ex = 150 - math.cos(angle) * 100
        ey = 150 - math.sin(angle) * 100
        axis_lines += f'<line x1="150" y1="150" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#334155" stroke-width="1"/>'
        lx, ly = radar_label_pos(i, n)
        anchor = "middle" if abs(lx - 150) < 10 else ("end" if lx < 150 else "start")
        axis_labels += (
            f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" '
            f'dominant-baseline="middle" fill="#94a3b8" font-size="11" font-family="DM Mono,monospace">'
            f'{METRIC_LABELS[c]}<tspan x="{lx:.1f}" dy="14" fill="#e2e8f0" font-weight="700">'
            f'{means[c]:.2f}</tspan></text>'
        )
    grid_circles = "".join(
        f'<circle cx="150" cy="150" r="{r}" fill="none" stroke="#1e293b" stroke-width="1"/>'
        for r in [25, 50, 75, 100]
    )

    radar_svg = f"""
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      {grid_circles}
      {axis_lines}
      <polygon points="{rad_pts}" fill="#3b82f6" fill-opacity="0.25" stroke="#3b82f6" stroke-width="2"/>
      {axis_labels}
    </svg>"""

    cards_html = ""
    for c in existing:
        v = means[c]
        col = score_color(v)
        grade = score_grade(v)
        spark_pts = sparkline_path(df[c].tolist())
        spark = (
            f'<svg width="120" height="32" class="sparkline">'
            f'<polyline points="{spark_pts}" fill="none" stroke="{col}" stroke-width="1.5"/>'
            f'</svg>'
            if spark_pts else ""
        )
        cards_html += f"""
        <div class="metric-card" style="--accent:{col}">
          <div class="metric-top">
            <span class="metric-name">{METRIC_LABELS[c]}</span>
            <span class="metric-grade" style="color:{col}">{grade}</span>
          </div>
          <div class="metric-score" style="color:{col}">{fmt_score_short(v)}</div>
          <div class="metric-desc">{METRIC_DESCS[c]}</div>
          <div class="metric-spark">{spark}</div>
          <div class="metric-bar">
            <div class="metric-bar-fill" style="width:{v*100:.1f}%;background:{col}"></div>
          </div>
        </div>"""

    type_rows = ""
    for qt, scores in type_stats.items():
        cells = "".join(
            f'<td style="color:{score_color_safe(scores.get(c, float('nan')))}">{fmt_score(scores.get(c, float('nan')))}</td>'
            for c in existing
        )
        valid_scores = [v for v in scores.values() if not math.isnan(v)]
        avg = float(np.nanmean(valid_scores)) if valid_scores else float("nan")
        type_rows += f"""
        <tr>
          <td class="qt-name">{html.escape(qt)}</td>
          {cells}
          <td style="color:{score_color_safe(avg)};font-weight:700">{fmt_score(avg)}</td>
        </tr>"""

    type_table = ""
    if type_rows:
        header_cells = "".join(f"<th>{METRIC_LABELS[c]}</th>" for c in existing)
        type_table = f"""
        <section class="section">
          <h2 class="section-title">Soru Tipine Göre Dağılım</h2>
          <div class="table-wrap">
            <table class="breakdown-table">
              <thead><tr><th>Soru Tipi</th>{header_cells}<th>Ortalama</th></tr></thead>
              <tbody>{type_rows}</tbody>
            </table>
          </div>
        </section>"""

    detail_rows = ""
    for _, row in df.iterrows():
        q   = html.escape(str(row.get("question", ""))[:120])
        ans = html.escape(str(row.get("answer", ""))[:200])
        gt  = html.escape(str(row.get("ground_truth", ""))[:120])
        def _cell_val(row, c):
            v = row.get(c, float("nan"))
            try:
                return float(v)
            except (TypeError, ValueError):
                return float("nan")
        metric_cells = "".join(
            f'<td style="color:{score_color_safe(_cell_val(row, c))}">{fmt_score(_cell_val(row, c))}</td>'
            for c in existing
        )
        detail_rows += f"""
        <tr>
          <td class="q-cell"><span class="q-text">{q}</span></td>
          <td class="a-cell">{ans}</td>
          <td class="gt-cell">{gt}</td>
          {metric_cells}
        </tr>"""

    detail_header = "".join(f"<th>{METRIC_LABELS[c]}</th>" for c in existing)

    overall_col   = score_color(overall)
    overall_grade = score_grade(overall)

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ESTÜ RAG Evaluation Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

  :root {{
    --bg:      #020817;
    --surface: #0f172a;
    --border:  #1e293b;
    --text:    #e2e8f0;
    --muted:   #64748b;
    --accent:  #3b82f6;
  }}

  body {{
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
    min-height: 100vh;
  }}

  .header {{
    padding: 48px 48px 32px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    flex-wrap: wrap;
  }}
  .header-left h1 {{
    font-family: 'Syne', sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    background: linear-gradient(135deg, #e2e8f0 30%, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  .header-left p {{
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
  }}
  .overall-badge {{
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px 32px;
    gap: 4px;
  }}
  .overall-label {{ color: var(--muted); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }}
  .overall-score {{ font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 800; line-height: 1; color: {overall_col}; }}
  .overall-grade {{ font-size: 12px; color: {overall_col}; }}

  .main {{ padding: 40px 48px; display: flex; flex-direction: column; gap: 48px; }}

  .section-title {{
    font-family: 'Syne', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 20px;
    letter-spacing: -0.01em;
  }}

  .cards-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }}
  .metric-card {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color .2s;
  }}
  .metric-card:hover {{ border-color: var(--accent); }}
  .metric-top {{ display: flex; justify-content: space-between; align-items: center; }}
  .metric-name {{ color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }}
  .metric-grade {{ font-size: 11px; font-weight: 500; }}
  .metric-score {{ font-family: 'Syne', sans-serif; font-size: 2.4rem; font-weight: 800; line-height: 1; }}
  .metric-desc {{ color: var(--muted); font-size: 11px; line-height: 1.5; }}
  .metric-bar {{ height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }}
  .metric-bar-fill {{ height: 100%; border-radius: 2px; transition: width .6s ease; }}
  .metric-spark {{ opacity: .8; }}

  .insights-row {{
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
    align-items: start;
  }}
  .radar-card {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }}
  .radar-title {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }}

  .table-wrap {{ overflow-x: auto; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    background: var(--surface);
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    white-space: nowrap;
  }}
  td {{ padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }}
  tr:last-child td {{ border-bottom: none; }}
  tr:hover td {{ background: #0f172a88; }}
  .qt-name {{ font-weight: 500; color: var(--text); white-space: nowrap; }}
  .breakdown-table td, .breakdown-table th {{ font-family: 'DM Mono', monospace; font-size: 12px; }}

  .detail-table {{ font-size: 11px; }}
  .detail-table th {{ font-size: 10px; }}
  .q-cell {{ max-width: 260px; }}
  .a-cell {{ max-width: 280px; color: var(--muted); }}
  .gt-cell {{ max-width: 200px; color: #475569; }}
  .q-text {{ color: var(--text); font-weight: 500; }}

  .footer {{
    padding: 24px 48px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 11px;
    display: flex;
    justify-content: space-between;
  }}

  @media (max-width: 768px) {{
    .header, .main, .footer {{ padding: 24px; }}
    .insights-row {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <h1>RAG Evaluation<br/>Report</h1>
    <p>ESTÜ Akademik Asistan · {generated_at}</p>
    <p style="margin-top:4px">Model: {GROQ_MODEL} · Embedding: {EMBED_MODEL}</p>
    <p style="margin-top:4px">Değerlendirilen soru sayısı: <strong style="color:var(--text)">{len(df)}</strong></p>
  </div>
  <div class="overall-badge">
    <span class="overall-label">Genel Skor</span>
    <span class="overall-score">{overall:.2f}</span>
    <span class="overall-grade">{overall_grade}</span>
  </div>
</header>

<main class="main">

  <section class="section">
    <h2 class="section-title">Metrik Skorları</h2>
    <div class="cards-grid">
      {cards_html}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">Radar Analizi</h2>
    <div class="insights-row">
      <div class="radar-card">
        <span class="radar-title">Performans Haritası</span>
        {radar_svg}
      </div>
      <div>
        <p style="color:var(--muted);font-size:12px;line-height:1.8;margin-bottom:16px">
          Radar grafiği, sistemin dört temel RAG metriği üzerindeki performans dengesini göstermektedir.
          İdeal bir sistem tüm eksenlerde 1.0'a yakın olmalıdır.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          {''.join(f"""
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:8px;height:8px;border-radius:50%;background:{score_color(means[c])};flex-shrink:0"></div>
            <div>
              <span style="color:var(--text);font-weight:500">{METRIC_LABELS[c]}</span>
              <span style="color:var(--muted);margin-left:8px">{means[c]:.3f}</span>
              <div style="color:var(--muted);font-size:11px">{METRIC_DESCS[c]}</div>
            </div>
          </div>""" for c in existing)}
        </div>
      </div>
    </div>
  </section>

  {type_table}

  <section class="section">
    <h2 class="section-title">Soru Bazlı Detay</h2>
    <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>Soru</th>
            <th>Model Yanıtı</th>
            <th>Ground Truth</th>
            {detail_header}
          </tr>
        </thead>
        <tbody>{detail_rows}</tbody>
      </table>
    </div>
  </section>

</main>

<footer class="footer">
  <span>ESTÜ Akademik Asistan RAG Evaluation Pipeline</span>
  <span>Oluşturulma: {generated_at}</span>
</footer>

</body>
</html>"""


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main() -> None:
    print("\n" + "═" * 56)
    print("  ESTÜ RAG Evaluation Pipeline")
    print("═" * 56 + "\n")

    if not DATASET_PATH.exists():
        print(f"[HATA] Dataset bulunamadı: {DATASET_PATH}")
        raise SystemExit(1)

    if not GROQ_API_KEY:
        print("[HATA] GROQ_API_KEY çevre değişkeni gerekli.")
        raise SystemExit(1)

    raw_data = load_dataset(DATASET_PATH)

    print("► AŞAMA 1 — Ajan Yanıtları Toplanıyor\n")
    processed = collect_answers(raw_data)

    print("\n► AŞAMA 2 — Ragas Değerlendirmesi (soru başına checkpoint)\n")
    df = run_ragas(processed)

    print("\n► AŞAMA 3 — Raporlar Oluşturuluyor\n")
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().strftime("%d.%m.%Y %H:%M")

    df.to_excel(REPORT_DIR / "evaluation_report.xlsx", index=False)
    df.to_csv(REPORT_DIR / "evaluation_report.csv", index=False)

    html_content = build_html_report(df, generated_at)
    html_path = REPORT_DIR / "evaluation_report.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"  ✓ Excel  → {REPORT_DIR / 'evaluation_report.xlsx'}")
    print(f"  ✓ CSV    → {REPORT_DIR / 'evaluation_report.csv'}")
    print(f"  ✓ HTML   → {html_path}")

    print("\n" + "─" * 40)
    print("  SONUÇ ÖZETİ")
    print("─" * 40)
    for col in [c for c in ["faithfulness", "answer_relevancy", "context_precision", "answer_correctness"] if c in df.columns]:
        v = df[col].mean()
        bar = "█" * int(v * 20) + "░" * (20 - int(v * 20))
        print(f"  {METRIC_LABELS[col]:<20} {bar}  {v:.3f}")
    print("─" * 40 + "\n")
    print(f"  Tarayıcıda görüntülemek için:\n  {html_path.resolve()}\n")


if __name__ == "__main__":
    main()