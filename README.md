# Sade Not

Mac için sade, e-posta davetli ve ortak çalışmalı not uygulaması.

## Çalışan özellikler

- Kişisel ve ortak çalışma alanları
- Not oluşturma, düzenleme, arama, favorileme ve çöp kutusu
- Zengin metin araçları ve otomatik kayıt
- Açık, koyu ve sistem teması
- Yerel demo modu; internet ve hesap gerektirmez
- Supabase bağlandığında e-posta ile şifresiz giriş
- E-posta adresine göre çalışma alanı üyeliği ve görüntüleme/düzenleme yetkileri
- Supabase Realtime ile cihazlar arasında canlı güncelleme
- E-posta daveti için macOS Mail uygulamasında hazır mesaj oluşturma
- Intel ve Apple Silicon için DMG derleme yapılandırması

## Yerel geliştirme

Gereksinimler: Node.js 22+, npm ve macOS üzerinde DMG üretimi için Xcode Command Line Tools.

```bash
npm install
npm run dev
```

Tarayıcıda yalnızca arayüzü çalıştırmak için:

```bash
npm run dev:web
```

## Supabase kurulumu

1. Supabase üzerinde yeni bir proje oluşturun.
2. `supabase/schema.sql` dosyasını Dashboard → SQL Editor içinde çalıştırın.
3. Authentication → URL Configuration → Redirect URLs alanına `sadenot://auth/callback` ekleyin.
4. Uygulamada Ayarlar → Bulut ve ortak çalışma bölümünü açın.
5. Project URL ile publishable key değerlerini girin. Dağıtım derlemesi bu proje için önceden yapılandırılmıştır.
6. E-postanıza gelen bağlantıyla giriş yapın.

`sb_publishable_...` anahtarı istemci uygulamalarında kullanılmak üzere tasarlanmıştır ve derlenmiş masaüstü uygulamasında bulunabilir. Eski `anon` anahtarları da desteklenir. `sb_secret_...` veya `service_role` anahtarını hiçbir zaman uygulamaya eklemeyin.

## DMG oluşturma

### Tek tıkla GitHub'a yükleme ve DMG alma

Mac üzerinde `GitHuba-Yukle.command` dosyasını açın. Yardımcı dosya GitHub oturumunu tarayıcıda doğrular, kaynakları `UmutKaanTorun/sade-not` deposunun `main` dalına gönderir, **Build macOS DMG** iş akışını takip eder ve tamamlanan DMG dosyalarını `release-from-github/` klasörüne indirir.

macOS dosyayı doğrudan açmazsa sağ tıklayıp **Aç** seçeneğini kullanın veya Terminal'de `bash GitHuba-Yukle.command` çalıştırın. GitHub parolanızı, erişim anahtarınızı veya Apple sertifikalarınızı bu dosyaya yazmayın.

### Yerel derleme

DMG yalnızca macOS üzerinde üretilebilir:

```bash
npm ci
npm test
npm run build:mac
```

Dosyalar `release/` klasöründe oluşur:

- `Sade-Not-0.1.0-arm64.dmg`
- `Sade-Not-0.1.0-x64.dmg`

GitHub Actions kullanmak için projeyi GitHub'a gönderip **Build macOS DMG** iş akışını manuel çalıştırın. DMG dosyaları iş akışı çıktısında `Sade-Not-macOS` adıyla sunulur.

## İmzalı ve noter onaylı DMG

Apple Developer hesabınız varsa GitHub deposunda **Settings → Secrets and variables → Actions** bölümüne şu secret değerlerini ekleyin:

- `MAC_CERTIFICATE_P12_BASE64`: Developer ID Application sertifikasının `.p12` çıktısı, base64 biçiminde
- `MAC_CERTIFICATE_PASSWORD`: `.p12` dışa aktarma parolası
- `APPLE_API_KEY_P8_BASE64`: App Store Connect API anahtarının `.p8` dosyası, base64 biçiminde
- `APPLE_API_KEY_ID`: App Store Connect Key ID
- `APPLE_API_ISSUER`: App Store Connect Issuer ID
- `APPLE_TEAM_ID`: Apple Developer Team ID

Ardından GitHub Actions içinden **Release Signed macOS DMG** iş akışını çalıştırın. Bu akış uygulamayı Developer ID ile imzalar, Apple noter kontrolüne gönderir ve Intel/Apple Silicon DMG dosyalarını çıktı olarak sunar.

Sertifika veya Apple API anahtarını sohbet içinde ya da kaynak koduna eklemeyin; yalnızca GitHub Actions secret alanına girin.

## Ortak düzenleme davranışı

Not değişiklikleri yaklaşık 600 ms bekleme sonrası kaydedilir ve Supabase Realtime ile diğer kullanıcılara iletilir. Bu MVP sürümü son kaydı esas alır. Karakter seviyesinde eşzamanlı, çakışmasız düzenleme için sonraki sürümde Yjs/CRDT katmanı eklenebilir.
