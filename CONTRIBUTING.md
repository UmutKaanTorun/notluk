# Katkıda Bulunma

Sade Not erken aşamada bir macOS not uygulamasıdır. Küçük ve odaklı değişiklikler en hızlı şekilde incelenir.

## Geliştirme Kurulumu

```bash
npm install
npm run dev
```

Yalnızca web arayüzünü çalıştırmak için:

```bash
npm run dev:web
```

## Kontroller

Pull request açmadan önce şunları çalıştırın:

```bash
npm test
npm run build
```

Electron paketleme, ikon, entitlement veya DMG çıktısını etkileyen değişikliklerde macOS üzerinde `npm run build:mac` komutunu da çalıştırın.

## Pull Request Notları

- Her PR'ı tek bir özellik veya düzeltmeye odaklayın.
- Arayüz değişikliklerinde ekran görüntüsü ekleyin.
- Supabase destekli davranışın, yerel demo davranışının veya ikisinin de test edilip edilmediğini belirtin.
- Secret, personal access token, Apple sertifikası veya yerel `.env` dosyası commit etmeyin.

## Güvenlik

Depoda bir secret veya auth/senkronizasyon akışında güvenlik sorunu bulursanız önce ilgili kimlik bilgisini yenileyin, ardından yeniden üretim adımlarıyla birlikte özel bir bildirim açın.
