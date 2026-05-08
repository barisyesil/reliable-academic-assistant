import fitz  # PyMuPDF
import re

class TranscriptParser:
    @staticmethod
    def parse_pdf(file_bytes: bytes):
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        full_text = ""
        for page in doc:
            full_text += page.get_text("text") + "\n"
        
        # 1. Dönemleri Yakala (Örn: "2022-2023 Güz Dönemi")
        semester_matches = list(re.finditer(r"(20\d{2}-20\d{2})\s*(Güz|Bahar|Yaz)\s*Dönemi", full_text, re.IGNORECASE))
        
        semesters_data = []
        
        for i, match in enumerate(semester_matches):
            semester_name = f"{match.group(1)} {match.group(2).capitalize()} Dönemi"
            
            # Bu dönemin içerdiği metin bloğu (iki dönem başlığı arasındaki metin)
            start_idx = match.end()
            end_idx = semester_matches[i+1].start() if i + 1 < len(semester_matches) else len(full_text)
            semester_text = full_text[start_idx:end_idx]
            
            courses = []
            
            # 2. Ders Kodlarını Yakala (TABLO ÇİZGİSİ ARANMAZ!)
            # Format: 2-5 arası büyük harf (arada boşluk olabilir) ve ardından 3 veya 4 rakam. 
            # Örn: "B M101", "ESTÜ 101", "MAT249", "TÜR125"
            course_pattern = r"\b([A-ZÇŞĞÜÖİ][A-ZÇŞĞÜÖİ\s]{1,4}\d{3,4})\b"
            course_matches = list(re.finditer(course_pattern, semester_text))
            
            for j, cmatch in enumerate(course_matches):
                course_code = cmatch.group(1).replace("\n", "").strip()
                
                # Sadece geçerli uzunluktaki kodları kabul et (Hatalı okumaları engeller)
                if len(course_code) < 5:
                    continue
                
                # İlgili dersin bloğunu kes
                c_start = cmatch.end()
                c_end = course_matches[j+1].start() if j + 1 < len(course_matches) else len(semester_text)
                chunk = semester_text[c_start:c_end]
                
                # Notu Yakala (ESTÜ özel notları dahil)
                grade_match = re.search(r"\b(AA|AB|BA|BB|BC|CB|CC|CD|DC|DD|FD|FF|S|U|DZ|YZ)\b", chunk)
                grade = grade_match.group(1) if grade_match else "BB"
                
                # AKTS'yi Yakala (Örn: 7.5, 6.0)
                credits = 3.0
                floats = re.findall(r"\b\d+\.\d+\b", chunk)
                for f_str in floats:
                    if len(f_str.split(".")[1]) == 1: # X.X formatındaki ilk sayıyı AKTS kabul et
                        credits = float(f_str)
                        break
                        
                # Ders Adını Temizle (İçindeki notları, statüleri, sayıları at)
                clean_chunk = re.sub(r"\b(AA|AB|BA|BB|BC|CB|CC|CD|DC|DD|FD|FF|S|U|DZ|YZ)\b", "", chunk)
                clean_chunk = re.sub(r"\b\d+\.\d+\b", "", clean_chunk)
                clean_chunk = re.sub(r"\b[ZSM]\b", "", clean_chunk) # Statü harfleri (Zorunlu, Seçmeli)
                clean_chunk = clean_chunk.replace("|", "").replace("\n", " ").strip()
                
                # İsimdeki gereksiz boşlukları sil
                course_name = re.sub(r"\s+", " ", clean_chunk)
                
                # Çok uzun gelen İngilizce/Türkçe birleşik isimleri kısalt
                if len(course_name) > 65:
                    course_name = course_name[:65].strip() + "..."
                
                courses.append({
                    "name": f"{course_code} - {course_name}",
                    "credits": credits,
                    "grade": grade
                })
            
            # Sadece içi dolu olan (ders bulabilmiş) dönemleri ekle
            if courses:
                semesters_data.append({
                    "semester_name": semester_name,
                    "courses": courses
                })
        
        return {"semesters": semesters_data, "raw_text": full_text[:500]}