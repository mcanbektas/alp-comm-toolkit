/**
 * Örnek EDS dosyası — `dbcFixture.ts` ile aynı rol: hem testlerin çıpası hem
 * arayüzün "örnek yükle" içeriği, böylece ekranda çalışan örnek testte de
 * yeşildir.
 *
 * ⚠️ Spec §43 EDS için doğrulanmış bir fixture VERMİYOR ve EDS söz dizimini de
 * hiç tanımlamıyor (dosya başı, `edsTypes.ts`). İçerik elle kuruldu; DataType
 * kodları CiA 301'in temel Object Dictionary girdileridir (0x1000 Device Type,
 * 0x1001 Error Register — CiA 301 çekirdeği; 0x6040/0x6041/0x6044 — CiA 402
 * servo profili, yaygın/kamuya açık nesneler).
 *
 * ── 1B (CANopen) İLE BAĞLANTI ────────────────────────────────────────────────
 * `canopen.ts`teki `sdo-write-controlword` örneği Index 0x6040 Sub 00 yazıyordu
 * ve payload'ı "EDS gerekir" uyarısıyla ham bırakmıştı. `pdo-statusword-velocity`
 * örneği de (`37 12 DC 05`) baytları ham gösteriyordu. Bu dosyadaki üç nesne
 * TAM OLARAK o iki dalganın bıraktığı boşluğu dolduruyor —
 * `edsDecoder.test.ts` bunu doğrudan doğrular: bayt0-1 (`37 12`) 0x6041
 * Statusword'e (UNSIGNED16 LE → 0x1237), bayt2-3 (`DC 05`) 0x6044 VL Velocity
 * Actual Value'ya (INTEGER16 LE → 1500) karşılık gelir. 0x606C (32-bit CSP/CSV
 * hız nesnesi) BİLEREK seçilmedi: dört baytlık PDO'da iki sinyale iki baytlık
 * pay ancak 16-bit'lik legacy VL nesnesiyle (0x6044) tutarlıdır.
 */

export const SAMPLE_EDS_DEVICE_TYPE_INDEX = 0x1000;
export const SAMPLE_EDS_ERROR_REGISTER_INDEX = 0x1001;
/** `canopen.ts`teki `sdo-write-controlword` örneğinin Index'i (Sub 00). */
export const SAMPLE_EDS_CONTROLWORD_INDEX = 0x6040;
/** `canopen.ts`teki `pdo-statusword-velocity` örneğinin ilk iki baytı. */
export const SAMPLE_EDS_STATUSWORD_INDEX = 0x6041;
/** Aynı PDO örneğinin son iki baytı (Velocity 1500 rpm, spec özet 04:102). */
export const SAMPLE_EDS_VELOCITY_INDEX = 0x6044;

export const SAMPLE_EDS_TEXT = `[FileInfo]
FileName=SAMPLE.eds
Description=CiA 402 servo drive object dictionary excerpt

[DeviceInfo]
VendorName=ALP Comm Toolkit
ProductName=Sample Servo Drive

[MandatoryObjects]
SupportedObjects=2
1=0x1000
2=0x1001

[1000]
ParameterName=Device Type
ObjectType=0x7
DataType=0x0007
AccessType=ro
DefaultValue=0x00020192

[1001]
ParameterName=Error Register
ObjectType=0x7
DataType=0x0005
AccessType=ro

[6040]
ParameterName=Controlword
ObjectType=0x7
DataType=0x0006
AccessType=rw
PDOMapping=1
LowLimit=0x0000
HighLimit=0xFFFF

[6041]
ParameterName=Statusword
ObjectType=0x7
DataType=0x0006
AccessType=ro
PDOMapping=1

[6044]
ParameterName=VL Velocity Actual Value
ObjectType=0x7
DataType=0x0003
AccessType=ro
PDOMapping=1
`;
