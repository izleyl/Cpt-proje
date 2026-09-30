# CPT Dikkat Testi

Blazor Server tabanlı bir **Sürekli Performans Testi (CPT)** uygulaması. Kullanıcıların dikkat, dürtü kontrolü ve tepki süresi performanslarını klinik benzeri bir ortamda yüksek hassasiyetle ölçmek için tasarlanmıştır.

---

##  Özellikler

-  5 Blokluk Yapılandırılmış Test: Giderek zorlaşan ve kuralları değişen aşamalar.
- Milisaniye Hassasiyeti: C# ve JS Interop köprüsü ile anlık tepki süresi (RT) ölçümü.
- Blok Bazlı Değerlendirme: Her aşamanın ardından toplanan verilerin işlenmesi.
- Detaylı Sonuç Ekranı: Test sonunda kullanıcının bilişsel profilini çıkaran dinamik özet kartı.
- Modern Arayüz: Kullanıcı odağını dağıtmayan karanlık tema (Dark Mode) tasarımı.

---

## Teknolojiler

| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| .NET | 8.0 | Arka uç mantığı ve sunucu yönetimi |
| Blazor Server | 8.0 | Dinamik UI, state yönetimi ve component mimarisi |
| JavaScript | ES6+ | Test motoru, zamanlayıcılar ve hassas event dinleme |
| Bootstrap / CSS3 | 5.x | Responsive tasarım ve modern UI elementleri |

---

## 📁 Proje Yapısı

```text
Cpt proje/
├── wwwroot/
│   ├── css/
│   │   └── app.css             # Özelleştirilmiş karanlık tema
│   ├── cpt-engine.js           # Test motoru (JS) - Uyaran render ve RT ölçümü
│   └── index.html
├── Layout/
│   ├── BosLayout.razor         # Test ekranı için özel düzen
│   └── MainLayout.razor        # Standart sayfa düzeni
├── Pages/
│   ├── Home.razor              # Proje vitrini ve kontrol paneli
│   ├── CptGiris.razor          # Test yönergeleri ve bilgilendirme
│   └── CptTest.razor           # 5 blokluk ana test ekranı
├── Models/
│   ├── Event.cs                # Test olayı modeli
│   ├── Session.cs              # Oturum modeli
│   └── Trial.cs                # Deneme/Uyarı modeli
└── Program.cs
```

---



##  Sayfalar ve Rotalar

| Rota | Dosya | Açıklama |
|------|-------|----------|
| `/` | `Home.razor` | Ana sayfa, projenin vizyonu ve kontrol paneli. |
| `/cpt-giris` | `CptGiris.razor` | Kullanıcıların test öncesi kuralları okuduğu bilgilendirme ekranı. |
| `/cpt-test` | `CptTest.razor` | Uyaranların gösterildiği ve verilerin toplandığı ana test motoru. |

---

##  Test Yapısı ve Metrikler

Uygulama 5 bloktan oluşur ve son bloğun bitimiyle otomatik olarak analiz ekranına geçer. Algoritma aşağıdaki hata ve başarı türlerini analiz eder:

- **Doğru Tepki (Hit):** Hedef uyarılara zamanında verilen doğru yanıtlar.
- **Atlama (Omission):** Kaçırılan hedefler *(Odaklanma eksikliğini temsil eder)*.
- **Yanlış Alarm (Commission):** Hedef olmayan uyarılara verilen tepkiler *(Dürtüselliği temsil eder)*.
- **Çoklu Tıklama (Hyperactivity):** Gereksiz ve art arda tuşa basma durumları.
- **Ortalama Tepki Süresi (RT):** Milisaniye cinsinden bilgi işleme hızı.

## 📄 Lisans

Bu proje **MIT** lisansı ile lisanslanmıştır.
