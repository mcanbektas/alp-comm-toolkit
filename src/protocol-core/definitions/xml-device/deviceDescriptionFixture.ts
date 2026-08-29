/**
 * Örnek GSDML, IODD ve SCL dosyaları.
 *
 * ── KAYNAK: SENTETİK, UYDURMA DEĞİL ─────────────────────────────────────────
 * Hiçbiri gerçek bir üreticinin dosyası değil ve öyle sunulmuyor. Öğe adları,
 * öznitelik adları ve iç içe geçme sırası standartlardan (GSDML V2.35, IODD
 * V1.1, IEC 61850-6); içerik bu dosya için yazıldı.
 *
 * Örnekler bilerek kısa: amaç bir aygıtı tam tarif etmek değil, panelin üç
 * biçimi de okuduğunu ve süreç verisini çözdüğünü göstermek.
 */

/** IO-Link: 32 bitlik süreç verisi + bir parametre. */
export const SAMPLE_IODD_TEXT = `<?xml version="1.0" encoding="utf-8"?>
<IODevice xmlns="http://www.io-link.com/IODD/2010/10">
  <ProfileBody>
    <DeviceIdentity vendorId="888" vendorName="ALP Comm Toolkit" deviceId="1001">
      <DeviceName textId="TI_DeviceName"/>
    </DeviceIdentity>
    <DeviceFunction>
      <ProcessDataCollection>
        <ProcessData id="PD">
          <ProcessDataIn id="PDI" bitLength="32">
            <Datatype xsi:type="RecordT" bitLength="32">
              <RecordItem subindex="1" bitOffset="16">
                <SimpleDatatype xsi:type="UIntegerT" bitLength="16"/>
                <Name textId="TI_Pressure"/>
              </RecordItem>
              <RecordItem subindex="2" bitOffset="8">
                <SimpleDatatype xsi:type="IntegerT" bitLength="8"/>
                <Name textId="TI_Temperature"/>
              </RecordItem>
              <RecordItem subindex="3" bitOffset="0">
                <SimpleDatatype xsi:type="BooleanT" bitLength="1"/>
                <Name textId="TI_Switch"/>
              </RecordItem>
            </Datatype>
          </ProcessDataIn>
        </ProcessData>
      </ProcessDataCollection>
      <VariableCollection>
        <Variable id="V_Mode" index="64" accessRights="rw" defaultValue="0">
          <Datatype xsi:type="UIntegerT" bitLength="8"/>
          <Name textId="TI_Mode"/>
          <SingleValue value="0"><Name textId="TI_ModeStandard"/></SingleValue>
          <SingleValue value="1"><Name textId="TI_ModeFast"/></SingleValue>
        </Variable>
      </VariableCollection>
    </DeviceFunction>
  </ProfileBody>
  <ExternalTextCollection>
    <PrimaryLanguage xml:lang="EN">
      <Text id="TI_DeviceName" value="ALP Pressure Sensor"/>
      <Text id="TI_Pressure" value="Process pressure"/>
      <Text id="TI_Temperature" value="Sensor temperature"/>
      <Text id="TI_Switch" value="Switching signal"/>
      <Text id="TI_Mode" value="Measurement mode"/>
      <Text id="TI_ModeStandard" value="Standard"/>
      <Text id="TI_ModeFast" value="Fast"/>
    </PrimaryLanguage>
  </ExternalTextCollection>
</IODevice>
`;

/**
 * Süreç verisi örneği: `04 D2 EC 01`
 *   0x04D2 = 1234  → Process pressure (bit 0..15, baştan)
 *   0xEC   = -20   → Sensor temperature (işaretli 8 bit)
 *   0x01   → en düşük bit 1 → Switching signal = true
 */
export const SAMPLE_IODD_PROCESS_DATA = Uint8Array.from([0x04, 0xd2, 0xec, 0x01]);

/** PROFINET: tek parametre kaydı, sözel değer listesi taşıyan bir kalem. */
export const SAMPLE_GSDML_TEXT = `<?xml version="1.0" encoding="utf-8"?>
<ISO15745ProfileContainer xmlns="http://www.profibus.com/GSDML/2003/11/DeviceProfile">
  <ISO15745Profile>
    <ProfileBody>
      <DeviceIdentity VendorID="0x02A0" DeviceID="0x0301" VendorName="TI_Vendor">
        <InfoText TextId="TI_Device"/>
      </DeviceIdentity>
      <DeviceFunction>
        <Family MainFamily="I/O"/>
      </DeviceFunction>
      <ApplicationProcess>
        <ParameterRecordDataItem Index="100" Length="4">
          <Ref ID="P1" DataType="Unsigned16" ByteOffset="0" DefaultValue="1000" TextId="TI_Filter"/>
          <Ref ID="P2" DataType="Unsigned8" ByteOffset="2" DefaultValue="0" TextId="TI_Range">
            <Assign Content="0" TextId="TI_RangeLow"/>
            <Assign Content="1" TextId="TI_RangeHigh"/>
          </Ref>
        </ParameterRecordDataItem>
        <ExternalTextList>
          <PrimaryLanguage>
            <Text TextId="TI_Vendor" Value="ALP Comm Toolkit"/>
            <Text TextId="TI_Device" Value="ALP IO Module 8DI"/>
            <Text TextId="TI_Filter" Value="Input filter time"/>
            <Text TextId="TI_Range" Value="Measuring range"/>
            <Text TextId="TI_RangeLow" Value="0-10 V"/>
            <Text TextId="TI_RangeHigh" Value="0-20 mA"/>
          </PrimaryLanguage>
        </ExternalTextList>
      </ApplicationProcess>
    </ProfileBody>
  </ISO15745Profile>
</ISO15745ProfileContainer>
`;

/** IEC 61850: tek IED, iki mantıksal düğüm, yapılandırılmış değerler. */
export const SAMPLE_SCL_TEXT = `<?xml version="1.0" encoding="utf-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <IED name="ALP_BAY1" manufacturer="ALP Comm Toolkit" type="ALP_PROT" configVersion="1.2">
    <AccessPoint name="S1">
      <Server>
        <LDevice inst="PROT">
          <LN0 lnClass="LLN0" inst="" lnType="LLN0_1"/>
          <LN prefix="" lnClass="PTOC" inst="1" lnType="PTOC_1">
            <DOI name="StrVal" desc="Pickup current">
              <DAI name="setMag"><Val>1.20</Val></DAI>
            </DOI>
            <DOI name="OpDlTmms">
              <DAI name="setVal"><Val>250</Val></DAI>
            </DOI>
          </LN>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>
`;
