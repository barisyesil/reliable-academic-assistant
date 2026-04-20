import { useState } from 'react'
import { FileText, Download, Eye, Search, BookOpen, FileCode, FileSpreadsheet } from 'lucide-react'

// Senin sağladığın güncel veri listesi
const initialResources = [
  {
    id: 1,
    title: '2547 Sayılı Yükseköğretim Kanunu',
    description: 'YÖK',
    type: 'pdf',
    size: '1.2 MB',
    url: '/dosyalar/yuksek-ogretim-kanunu.pdf',
  },
  {
    id: 2,
    title: 'Eskişehir Teknik Üniversitesi Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği',
    description: 'Yönetmelik',
    type: 'pdf',
    size: '513 KB',
    url: '/dosyalar/estu-lisans-onlisans-sınav-yonetmeliği.pdf'
  },
  {
    id: 3,
    title: 'Yükseköğretim Kurumları Öğrenci Konseyleri ve Yükseköğretim Kurumları Ulusal Öğrenci Konseyi Yönetmeliği',
    description: 'Yönetmelik',
    type: 'pdf',
    size: '44 KB',
    url: '/dosyalar/ogrenci-konseyleri.pdf'
  },
  {
    id: 4,
    title: 'Eskişehir Teknik Üniversitesi Sürekli Eğitim Uygulama ve Araştırma Merkezi Yönetmeliği',
    description: 'Yönetmelik',
    type: 'pdf',
    size: '463 KB',
    url: '/dosyalar/surekli-egitim-uygulama-yonetmeligi.pdf'
  },
  {
    id: 5,
    title: 'Eskişehir Teknik Üniversitesi Yabancı Dil Hazırlık Programı Eğitim-Öğretim ve Sınav Yönetmeliği',
    description: 'Yönetmelik',
    type: 'pdf',
    size: '475 KB',
    url: '/dosyalar/yabancı-dil-egitim-sınav.pdf'
  },
  {
    id: 6,
    title: 'Akademik Danışmanlık Yönergesi',
    description: 'Öğrencilere verilecek akademik danışmanlık hizmetiyle ilgili usul ve esaslar.',
    type: 'pdf',
    size: '176 KB',
    url: '/dosyalar/akademik-danismanlik-yonergesi.pdf',
  },
  {
    id: 7,
    title: 'Diploma, Diploma Eki ve Diğer Belgeler Yönergesi',
    description: 'Diploma, sertifika ve diğer mezuniyet belgelerinin düzenlenme usulleri.',
    type: 'pdf',
    size: '170 KB',
    url: '/dosyalar/diploma-ve-diger-belgeler-yonergesi.pdf',
  },
  {
    id: 8,
    title: 'Kariyer Gelişimi ve Öğrenci Destek Birimi Yönergesi',
    description: 'Kariyer gelişimi biriminin kuruluş, yönetim ve faaliyet alanları.',
    type: 'pdf',
    size: '315 KB',
    url: '/dosyalar/kariyer-gelisimi-birimi-yonergesi.pdf',
  },
  {
    id: 9,
    title: 'Mühendislik Fakültesi Staj Yönergesi',
    description: 'Mühendislik öğrencilerinin zorunlu staj planlama ve uygulama esasları.',
    type: 'pdf',
    size: '692 KB',
    url: '/dosyalar/muhendislik-fakultesi-staj-yonergesi.pdf',
  },
  {
    id: 10,
    title: 'Ortak Dersler Bölümü Yönergesi',
    description: 'Ortak zorunlu ve seçmeli derslerin yürütülmesine ilişkin esaslar.',
    type: 'pdf',
    size: '364 KB',
    url: '/dosyalar/ortak-dersler-bolumu-yonergesi.pdf',
  },
  {
    id: 11,
    title: 'Öğrenci Kulüpleri Yönergesi',
    description: 'Öğrenci kulüplerinin kuruluşu, işleyişi ve etkinlik düzenleme kuralları.',
    type: 'pdf',
    size: '208 KB',
    url: '/dosyalar/ogrenci-kulupleri-yonergesi.pdf',
  },
  {
    id: 12,
    title: 'Önlisans ve Lisans Programlarına Yatay Geçiş Yönergesi',
    description: 'Yatay geçiş, dikey geçiş, çift anadal, yandal ve ders transferi işlemlerine ilişkin usul ve esaslar.',
    type: 'pdf',
    size: '447 KB',
    url: '/dosyalar/onlisans-ve-lisans-programlarina-yatay-gecis-yonergesi.pdf',
  },
  {
    id: 13,
    title: 'Yurt Dışından Kabul Edilecek Öğrenciler İçin Başvuru Yönergesi',
    description: 'Yurt dışından kabul edilecek öğrencilerin başvuru, kabul ve kayıt koşullarına ilişkin usul ve esaslar.',
    type: 'pdf',
    size: '341 KB ',
    url: '/dosyalar/yurt-disindan-kabul-edilecek-ogrenciler-yonergesi.pdf',
  },
  {
    id: 14,
    title: 'Proje Temelli Staj Yönergesi',
    description: 'Proje Temelli Staj uygulamasının temel ilkelerini planlama, uygulama ve değerlendirme esasları.',
    type: 'pdf',
    size: '251 KB',
    url: '/dosyalar/proje-temelli-staj-yonergesi.pdf',
  },
  {
    id: 15,
    title: 'Mühendislik Fakültesi Staj Yönergesi (2024)',
    description: 'Mühendislik Fakültesi öğrencilerinin yapmakla yükümlü oldukları stajların temel ilkeleri.',
    type: 'pdf',
    size: '1.6 MB',
    url: '/dosyalar/muhendislik-fakultesi-staj-yonergesi-2024.pdf',
  },
  {
    id: 16,
    title: 'Azami Süre Sonunda Mezun Olamayan Öğrencilere Verilen Ek Sınav Esasları',
    description: 'Azami öğrenim süresini doldurup mezun olamayan öğrencilere tanınan ek sınav hakları.',
    type: 'pdf',
    size: '243 KB',
    url: '/dosyalar/azami-sure-sonu-ek-sinav-esaslari.pdf',
  },
  {
    id: 17,
    title: 'Ortak Dersler Uygulama Usul ve Esasları',
    description: 'ESTÜ ortak dersleri ve birimler arası ortak derslerin yürütülmesine ilişkin esaslar.',
    type: 'pdf',
    size: '129 KB',
    url: '/dosyalar/ortak-dersler-uygulama-esaslari.pdf',
  },
  {
    id: 18,
    title: 'Tek Ders Sınavı Uygulama Esasları',
    description: 'Mezun olabilecek durumdaki öğrencilerin katılabileceği tek ders sınavı koşulları.',
    type: 'pdf',
    size: '122 KB',
    url: '/dosyalar/tek-ders-sinavi-uygulama-esaslari.pdf',
  },
  {
    id: 19,
    title: 'Uluslararası Değişim Programları Yabancı Dil Sınavı Uygulama Esasları',
    description: 'Erasmus+ ve değişim programları için uygulanan yabancı dil sınavı esasları.',
    type: 'pdf',
    size: '211 KB',
    url: '/dosyalar/degisim-programlari-yabanci-dil-sinavi-esaslari.pdf',
  },
  {
    id: 20,
    title: 'Yaz Okulu Uygulama Esasları',
    description: 'Yaz okulunda ders açılması, kayıt ve sınav süreçlerine ilişkin usul ve esaslar.',
    type: 'pdf',
    size: '140 KB',
    url: '/dosyalar/yaz-okulu-uygulama-esaslari.pdf',
  },
  {
    id: 21,
    title: 'Haklı ve Geçerli Nedenlere İlişkin Usul ve Esaslar',
    description: 'Öğrencilerin haklı ve geçerli mazeretlerine ilişkin sağlık raporu ve diğer hususlar.',
    type: 'pdf',
    size: '170 KB',
    url: '/dosyalar/hakli-ve-gecerli-nedenler-esaslari.pdf',
  },
  {
    id: 22,
    title: 'Not Dönüşüm ve Eşdeğerlik Uygulama Esasları',
    description: 'Not ortalamalarının diğer sistemlerdeki karşılıkları ve yabancı dil eşdeğerlikleri.',
    type: 'pdf',
    size: '579 KB',
    url: '/dosyalar/not-donusum-ve-esdegerlik-esaslari.pdf',
  }
]

const typeConfig = {
  pdf:  { icon: FileText,        color: 'text-red-400',    bg: 'bg-red-400/10',    label: 'PDF' },
  pptx: { icon: FileSpreadsheet, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'PPTX' },
  docx: { icon: FileText,        color: 'text-blue-400',   bg: 'bg-blue-400/10',   label: 'DOCX' },
  code: { icon: FileCode,        color: 'text-emerald-400',bg: 'bg-emerald-400/10',label: 'ZIP' },
}

export default function ResourcesPage() {
  const [search, setSearch] = useState('')

  // Sadece başlığa göre arama yapıyoruz
  const filtered = initialResources.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">

      {/* Topbar */}
      <div className="h-14 bg-[#141414] border-b border-white/[0.06] flex items-center px-5 gap-3 flex-shrink-0">
        <BookOpen size={16} className="text-[#EF5350] flex-shrink-0" />
        <h1 className="font-['Syne'] text-[15px] font-bold text-white flex-1">Kaynaklar</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5
        [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10
        [&::-webkit-scrollbar-track]:bg-transparent">

        {/* Search Bar (Sadeleştirilmiş) */}
        <div className="mb-5">
          <div className="flex items-center gap-2.5 bg-[#1a1a1a] border border-white/[0.07]
            rounded-[10px] px-3 py-2 focus-within:border-[#D32F2F]/30 transition-colors">
            <Search size={13} className="text-white/30 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kaynak ara..."
              className="flex-1 bg-transparent border-none outline-none text-[13px]
                text-white/70 placeholder-white/20 font-['DM_Sans']"
            />
          </div>
        </div>

        {/* Resource list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-white/20 font-['DM_Sans'] text-[13px]">
              Kaynak bulunamadı.
            </div>
          )}

          {filtered.map(resource => {
            const cfg = typeConfig[resource.type] || typeConfig.pdf
            const Icon = cfg.icon
            return (
              <div
                key={resource.id}
                className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl
                  px-4 py-3.5 flex items-center gap-4
                  hover:border-white/[0.12] transition-all group"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-[9px] flex items-center justify-center
                  flex-shrink-0 ${cfg.bg}`}>
                  <Icon size={18} className={cfg.color} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13.5px] text-white/80 font-['DM_Sans'] font-medium truncate">
                      {resource.title}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]
                      ${cfg.bg} ${cfg.color} flex-shrink-0`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/30 font-['DM_Sans'] truncate">
                    {resource.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-[#EF5350]/70 font-['DM_Sans']">
                      {resource.course}
                    </span>
                    <span className="text-[11px] text-white/20 font-['DM_Sans']">
                      {resource.size}
                    </span>
                    <span className="text-[11px] text-white/20 font-['DM_Sans']">
                      {resource.uploadedAt}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100
                  transition-opacity flex-shrink-0">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 bg-white/[0.04] border border-white/[0.07]
                      rounded-[7px] flex items-center justify-center
                      hover:bg-white/[0.09] transition-colors"
                    title="Görüntüle"
                  >
                    <Eye size={13} className="text-white/50" />
                  </a>
                  <a
                    href={resource.url}
                    download
                    className="w-8 h-8 bg-[#D32F2F]/10 border border-[#D32F2F]/20
                      rounded-[7px] flex items-center justify-center
                      hover:bg-[#D32F2F]/20 transition-colors"
                    title="İndir"
                  >
                    <Download size={13} className="text-[#EF5350]" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}