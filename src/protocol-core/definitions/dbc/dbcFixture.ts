/**
 * Örnek DBC dosyası — `schemas/specFixture.ts` ile aynı rolü oynar: hem
 * testlerin çıpası hem arayüzün "örnek yükle" içeriğidir, böylece ekranda
 * çalışan örnek testte de yeşildir.
 *
 * ⚠️ Spec §43 DBC için doğrulanmış bir fixture VERMİYOR (yedi fixture'ın hiçbiri
 * DBC değil) ve DBC söz dizimini de hiç tanımlamıyor. Bu yüzden içerik elle
 * kuruldu ve beklenen değerleri `dbcDecoder.test.ts` gerçek motorla doğruluyor.
 *
 * Örneğin kapsadığı zor durumlar bilinçli seçildi:
 *   • Intel (`@1`) ve Motorola (`@0`) sinyaller YAN YANA — ikisinin başlangıç
 *     biti farklı şey demektir, karıştırılırsa değer sessizce yanlış çıkar.
 *   • İşaretli sinyal (`@1-`) — iki tümleyen dönüşümü.
 *   • Extended identifier — dosyada 0x80000000 bayrağıyla yazılır.
 *   • Çoklama (`M` / `m0` / `m1`) — aynı bitler iki anlam taşır.
 *   • `VAL_` değer tablosu ve `CM_` yorumları.
 */

/** Örnekteki mesajların identifier'ları — testler ve arayüz aynı sabitleri kullanır. */
export const SAMPLE_DBC_ENGINE_ID = 0x123;
export const SAMPLE_DBC_MUX_ID = 0x200;
/** Extended: J1939 dalgasının §43 fixture identifier'ıyla aynı değer. */
export const SAMPLE_DBC_EXTENDED_ID = 0x18f00401;

export const SAMPLE_DBC_TEXT = `VERSION "1.0"

NS_ :

BS_:

BU_: Gateway Engine Dashboard

BO_ 291 EngineData: 8 Engine
 SG_ EngineSpeed : 0|16@1+ (0.125,0) [0|8031.875] "rpm" Gateway,Dashboard
 SG_ CoolantTemp : 16|8@1+ (1,-40) [-40|215] "degC" Dashboard
 SG_ Torque : 24|16@1- (1,0) [-32768|32767] "Nm" Gateway

BO_ 2565866497 DiagResponse: 8 Gateway
 SG_ ResponseCode : 7|16@0+ (1,0) [0|65535] "" Engine

BO_ 512 SensorMux: 8 Gateway
 SG_ Selector M : 0|8@1+ (1,0) [0|255] "" Engine
 SG_ TempA m0 : 8|16@1+ (0.1,0) [0|6553.5] "degC" Engine
 SG_ VoltB m1 : 8|16@1+ (0.001,0) [0|65.535] "V" Engine

CM_ BO_ 291 "Engine data broadcast";
CM_ SG_ 291 EngineSpeed "Crankshaft speed";
VAL_ 291 CoolantTemp 0 "Sensor error" 255 "Not available" ;
`;
