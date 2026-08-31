/**
 * Örnek LDF dosyaları — `edsFixture.ts`/`xifFixture.ts`/`gsdFixture.ts` ile aynı
 * rol: hem testlerin çıpası hem arayüzün açılış içeriği, böylece ekran BOŞ
 * AÇILMAZ (spec §50) ve ekranda çalışan örnek testte de yeşildir.
 *
 * ── ⚠ FIXTURE UYDURULMADI — KAYNAK KATMANI AÇIKÇA ───────────────────────────
 * Brifin uyarısı doğru çıktı: `.ldf` uzantısı SQL Server işlem günlüğü
 * dosyalarıyla çakışıyor ve uzantıyla arama işe yaramıyor. Arama bunun yerine
 * biçimin KENDİ anahtar sözcükleriyle yapıldı (`LIN_description_file`,
 * `LIN_protocol_version`, `Schedule_tables`) ve **27 gerçek `.ldf` dosyası**
 * toplanıp okundu: üretici araçlarının ürettiği dosyalar (Vector DaVinci
 * Network Designer, NXP S32 SDK örnekleri), gerçek OEM dosyaları (VW MEB
 * J848 ısıtıcı, BYD, Changan) ve açık kaynak LIN araç zincirlerinin sınama
 * kümeleri (`c4deszes/ldfparser`, `ecubus/EcuBus-Pro`). Aşağıdaki iki fixture
 * bu kümedendir. **Hiçbir sinyal, hiçbir çerçeve, hiçbir ofset uydurulmadı.**
 *
 * ── `SAMPLE_LDF_TEXT` — Vector Informatik, koltuk motoru LIN kümesi ─────────
 * Dosyanın kendi başlığı kaynağını yazıyor: *"LIN Description file created
 * using Vector's DaVinci Network Designer / Author: Vector Informatik GmbH /
 * Created: 25 Oct 2007"*. **Doğrudan Vector'ün portalından DEĞİL**, Apache-2.0
 * lisanslı açık kaynak `ecubus/EcuBus-Pro` LIN aracının sınama kümesinden
 * alındı (`test/dolin/2.2.ldf`) — yani kaynak ÜRETİCİ DEĞİL AYNA, `gsdFixture`
 * ile birebir aynı katman ve aynı açıklıkla söyleniyor.
 *
 * Neden BU dosya: elde edilen 27 dosya taranıp §9.2'nin bölümlerine göre
 * puanlandı; izin verilen lisansa sahip olanlar içinde söz diziminin en geniş
 * kesitini TEK dosyada taşıyan bu (12 bölümün 10'u). İçinde hepsi var —
 * `Diagnostic_signals`, olay tetiklemeli çerçeve, iki teşhis çerçevesi, iki
 * düğümün tam `Node_attributes`ı (`configurable_frames` dahil), beş çizelge
 * tablosu, hem `physical_value` hem `logical_value` taşıyan kodlama tipleri, ve
 * — en önemlisi — dört ÖLÇÜLEN gerçek dünya tuzağı:
 *
 *   1. **Bayt dizisi vs skaler.** `Motor1Position: 32, {0, 0, 0, 0}` küme
 *      parantezli (bayt dizisi), `Motor2Temp: 8, 0` değil (skaler). §9.2.3.1'in
 *      "ayrımın TEK yolu init_value'a bakmaktır" cümlesinin canlı örneği.
 *   2. **HİZASIZ BAYT DİZİSİ — üreticinin kendi dosyasında.** `Motor1Temp` 7
 *      bit olduğu için `Motor1Position` bit 7'den başlıyor; kardeşi
 *      `Motor2Temp` 8 bit olduğu için `Motor2Position` bit 8'den. §2.2.3 "bayt
 *      dizisindeki her bayt TEK bir çerçeve baytına oturmalıdır" diyor, yani
 *      Motor1'inki kurala UYMUYOR. Ayrıştırıcı bunu satır numaralı bir uyarı
 *      olarak bildirir ve çözücü o sinyalde okuma UYDURMAZ. Bu asimetri
 *      elle kurulmuş bir dosyada bulunmazdı.
 *   3. **Onluk ve onaltılık kimlikler aynı dosyada.** Koşulsuz çerçeveler
 *      `53`/`51`/`45`, teşhis çerçeveleri `0x3c`/`0x3d`.
 *   4. **Ayrık biçimlendirme.** `Master : SeatECU` (iki nokta önce boşluk),
 *      `Motor1{` (parantez önce boşluk YOK), çizelge adları bir boşluk girintili.
 *      Satır tabanlı bir okuyucu bunların en az birinde kırılırdı.
 *
 * İçerik **KISALTILMADI** ve tek karakteri değiştirilmedi (dosya zaten LF satır
 * sonlu ve saf ASCII). Kısaltmak `configurable_frames` zincirini ve
 * `Signal_representation` referanslarını bozardı.
 *
 * ── `SAMPLE_LIN13_LDF_TEXT` — LIN 1.3 lehçesi ───────────────────────────────
 * `SAMPLE_LDF_TEXT`in test EDEMEDİĞİ üç lehçe farkını test etsin diye ayrıca
 * tutuldu. Kaynak katmanı FARKLIDIR ve bu açıkça söylenmeli: bu bir üretici
 * dosyası DEĞİL, MIT lisanslı açık kaynak `c4deszes/ldfparser` kitaplığının
 * sınama kümesindeki gerçek bir dosya (`tests/ldf/lin13.ldf`, dosyanın kendi
 * başlığı *"Issued by Istvan Horvath"* diyor) — `gsdFixture`ın pyprofibus
 * sınama dosyalarını 14'lük kümesine sayarken kullandığı katmanla aynı.
 * İzin verilen lisansa sahip, gerçek bir LIN 1.3 dosyası başka bulunamadı.
 *
 * Kanıtladığı üç şey:
 *   1. **`Node_attributes` bölümü HİÇ YOK.** LIN 1.3'te böyle bir bölüm
 *      yoktur; yerine `Diagnostic_addresses { LSM: 1; CPM: 0x02; }` vardır.
 *      İkisi de okunuyor ve checksum çözümü bu dosyada küme sürümüne düşüyor.
 *   2. **`Signal_groups` kullanılıyor.** §9.2.3.3 bunu "LIN 1.3 özelliği,
 *      kullanımdan kalktı" diye tanır ama söz dizimini VERİR — o yüzden
 *      okunuyor, yok sayılmıyor.
 *   3. **Çerçeve boyu YAZILMAYABİLİR.** `VL1_CEM_Frm2:48,CEM {` boy alanı
 *      taşımıyor; `VL1_CEM_Frm1:32,CEM,3 {` taşıyor ve dosyanın kendi yorumu
 *      "The length of this frame is redefined to 3" diyor. Boy yoksa
 *      `lengthBytes` `undefined` kalır ve uyarı üretilir — 1.3'ün kimlikten
 *      boy türeten kuralı UYGULANMAZ, çünkü o kural 2.2A'da YOKTUR (arandı,
 *      geçmiyor) ve o belge bu depoda yok.
 * Bu dosya da KISALTILMADI.
 */

/** Açılış fixture'ının koşulsuz çerçeve sayısı (`Frames` bölümü). */
export const SAMPLE_LDF_UNCONDITIONAL_FRAME_COUNT = 7;

/** Dört çerçeve bölümünün TOPLAMI: 7 koşulsuz + 1 olay tetiklemeli + 2 teşhis. */
export const SAMPLE_LDF_FRAME_COUNT = 10;

/** `Signals` bölümündeki sinyal sayısı (`Diagnostic_signals` HARİÇ). */
export const SAMPLE_LDF_SIGNAL_COUNT = 15;

/** `Diagnostic_signals` bölümü — §9.2.3.2'nin sabit on altı baytı. */
export const SAMPLE_LDF_DIAGNOSTIC_SIGNAL_COUNT = 16;

export const SAMPLE_LDF_SCHEDULE_TABLE_COUNT = 5;

export const SAMPLE_LDF_NODE_ATTRIBUTE_COUNT = 2;

/**
 * Hizasız bayt dizisi taşıyan çerçeve — fixture notundaki 2. tuzak.
 * `Motor1State_Cycl` içinde `Motor1Position` bit 7'den başlıyor.
 */
export const SAMPLE_LDF_UNALIGNED_FRAME = 'Motor1State_Cycl';

/** Kardeşi: aynı yerleşim ama bit 8'den, yani KURALA UYGUN. */
export const SAMPLE_LDF_ALIGNED_FRAME = 'Motor2State_Cycl';

export const SAMPLE_LDF_TEXT = `/*************************************************************************************/

//                                                                                     

// Description: LIN Description file created using Vector's DaVinci Network Designer   

// Created:     25 Oct 2007 15:32:29

// Author:      Vector Informatik GmbH

// Version:     0.1                                                                    

//                                                                                     

/*************************************************************************************/

LIN_description_file;
LIN_protocol_version = "2.2";
LIN_language_version = "2.2";
LIN_speed = 19.2 kbps;

Nodes {
  Master : SeatECU, 5 ms, 0.1 ms ;
  Slaves : Motor1, Motor2 ;
}

Signals {
  Motor1_Dynamic_Sig: 8, 7, Motor1, SeatECU ;
  Motor1ErrorCode: 8, 5, Motor1, SeatECU ;
  Motor1ErrorValue: 8, 1, Motor1, SeatECU ;
  Motor1LinError: 1, 0, Motor1, SeatECU ;
  Motor1Position: 32, {0, 0, 0, 0}, Motor1, SeatECU ;
  Motor1Temp: 7, 5, Motor1, SeatECU ;
  Motor2_Dynamic_Sig: 8, 8, Motor2, SeatECU ;
  Motor2ErrorCode: 8, 2, Motor2, SeatECU ;
  Motor2ErrorValue: 8, 4, Motor2, SeatECU ;
  Motor2LinError: 1, 0, Motor2, SeatECU ;
  Motor2Position: 32, {0, 0, 0, 0}, Motor2, SeatECU ;
  Motor2Temp: 8, 0, Motor2, SeatECU ;
  MotorDirection: 2, 0, SeatECU, Motor1, Motor2 ;
  MotorSelection: 4, 0, SeatECU, Motor1, Motor2 ;
  MotorSpeed: 10, 0, SeatECU, Motor1, Motor2 ;
}

Diagnostic_signals {
  MasterReqB0: 8, 0 ;
  MasterReqB1: 8, 0 ;
  MasterReqB2: 8, 0 ;
  MasterReqB3: 8, 0 ;
  MasterReqB4: 8, 0 ;
  MasterReqB5: 8, 0 ;
  MasterReqB6: 8, 0 ;
  MasterReqB7: 8, 0 ;
  SlaveRespB0: 8, 0 ;
  SlaveRespB1: 8, 0 ;
  SlaveRespB2: 8, 0 ;
  SlaveRespB3: 8, 0 ;
  SlaveRespB4: 8, 0 ;
  SlaveRespB5: 8, 0 ;
  SlaveRespB6: 8, 0 ;
  SlaveRespB7: 8, 0 ;
}



Frames {
  Motor1_Dynamic: 53, Motor1, 1 {
    Motor1_Dynamic_Sig, 0 ;
  }
  Motor1State_Cycl: 51, Motor1, 6 {
    Motor1Temp, 0 ;
    Motor1Position, 7 ;
    Motor1LinError, 40 ;
  }
  Motor1State_Event: 54, Motor1, 3 {
    Motor1ErrorCode, 8 ;
    Motor1ErrorValue, 16 ;
  }
  Motor2_Dynamic: 44, Motor2, 1 {
    Motor2_Dynamic_Sig, 0 ;
  }
  Motor2State_Cycl: 52, Motor2, 6 {
    Motor2Temp, 0 ;
    Motor2Position, 8 ;
    Motor2LinError, 40 ;
  }
  Motor2State_Event: 55, Motor2, 3 {
    Motor2ErrorCode, 8 ;
    Motor2ErrorValue, 16 ;
  }
  MotorControl: 45, SeatECU, 2 {
    MotorDirection, 0 ;
    MotorSpeed, 2 ;
    MotorSelection, 12 ;
  }
}


Event_triggered_frames {
  ETF_MotorStates: ETF_CollisionResolving, 58, Motor1State_Event, Motor2State_Event ;
}

Diagnostic_frames {
  MasterReq: 0x3c {
    MasterReqB0, 0 ;
    MasterReqB1, 8 ;
    MasterReqB2, 16 ;
    MasterReqB3, 24 ;
    MasterReqB4, 32 ;
    MasterReqB5, 40 ;
    MasterReqB6, 48 ;
    MasterReqB7, 56 ;
  }
  SlaveResp: 0x3d {
    SlaveRespB0, 0 ;
    SlaveRespB1, 8 ;
    SlaveRespB2, 16 ;
    SlaveRespB3, 24 ;
    SlaveRespB4, 32 ;
    SlaveRespB5, 40 ;
    SlaveRespB6, 48 ;
    SlaveRespB7, 56 ;
  }
}

Node_attributes {
  Motor1{
    LIN_protocol = "2.2" ;
    configured_NAD = 0x2 ;
    initial_NAD = 0x2 ;
    product_id = 0x1E, 0x1, 0 ;
    response_error = Motor1LinError ;
    P2_min = 100 ms ;
    ST_min = 20 ms ;
    N_As_timeout = 1000 ms ;
    N_Cr_timeout = 1000 ms ;
    configurable_frames {
      MotorControl ;
      Motor1State_Cycl ;
      Motor1State_Event ;
      ETF_MotorStates ;
      Motor1_Dynamic ;
    }
  }
  Motor2{
    LIN_protocol = "2.2" ;
    configured_NAD = 0x3 ;
    initial_NAD = 0x3 ;
    product_id = 0x1E, 0x1, 0 ;
    response_error = Motor2LinError ;
    P2_min = 100 ms ;
    ST_min = 20 ms ;
    N_As_timeout = 1000 ms ;
    N_Cr_timeout = 1000 ms ;
    configurable_frames {
      MotorControl ;
      Motor2State_Cycl ;
      Motor2State_Event ;
      ETF_MotorStates ;
      Motor2_Dynamic ;
    }
  }
}

Schedule_tables {
 NormalTable {
    MotorControl delay 50 ms ;
    Motor1State_Cycl delay 50 ms ;
    Motor2State_Cycl delay 50 ms ;
  }
 DynamicTable {
    Motor1_Dynamic delay 100 ms ;
    Motor2_Dynamic delay 5 ms ;
  }
 NormalTableEvent {
    MotorControl delay 50 ms ;
    Motor1State_Cycl delay 50 ms ;
    Motor2State_Cycl delay 50 ms ;
    ETF_MotorStates delay 50 ms ;
  }
 InitTable {
    AssignFrameId { Motor1, Motor1State_Cycl } delay 10 ms ;
    AssignFrameId { Motor2, Motor2State_Cycl } delay 10 ms ;
    AssignFrameId { Motor1, Motor1State_Event } delay 10 ms ;
    AssignFrameId { Motor2, Motor2State_Event } delay 10 ms ;
    AssignFrameId { Motor1, Motor1_Dynamic } delay 10 ms ;
    AssignFrameId { Motor1, ETF_MotorStates } delay 10 ms ;
    AssignFrameId { Motor2, ETF_MotorStates } delay 10 ms ;
    AssignFrameId { Motor1, MotorControl } delay 10 ms ;
    AssignFrameId { Motor2, MotorControl } delay 10 ms ;
  }
 ETF_CollisionResolving {
    Motor2State_Event delay 10 ms ;
    Motor1State_Event delay 10 ms ;
  }
}


Signal_encoding_types {
  MotorSpeed {
    physical_value, 0, 0, 1, 0, "rpm" ;
  }
  encTemperature {
    physical_value, 0, 80, 0.5, -20, "Degree" ;
    logical_value, 0, "Initial" ;
    logical_value, 1, "LON" ;
    logical_value, 2, "NORMAL" ;
    logical_value, 3, "HIGH" ;
    logical_value, 4, "Reserved" ;
    logical_value, 5, "Reserved" ;
    logical_value, 6, "Reserved" ;
    logical_value, 7, "Invalid" ;
  }
}

Signal_representation {
  MotorSpeed: MotorSpeed ;
  encTemperature: Motor1Temp, Motor2Temp ;
}
`;

/** LIN 1.3 fixture'ının çerçeve sayısı. */
export const SAMPLE_LIN13_FRAME_COUNT = 7;

/** LIN 1.3 fixture'ının sinyal sayısı. */
export const SAMPLE_LIN13_SIGNAL_COUNT = 49;

/** Boy alanı YAZILMAMIŞ çerçeve — lehçe farkı 3. */
export const SAMPLE_LIN13_UNSIZED_FRAME = 'VL1_CEM_Frm2';

export const SAMPLE_LIN13_LDF_TEXT = `// This is a LIN description example file
// Issued by Istvan Horvath

LIN_description_file ;
LIN_protocol_version = "1.3";
LIN_language_version = "1.3";
LIN_speed = 19.2 kbps;

Nodes {
    Master : CEM,5 ms, 0.1 ms;
    Slaves : LSM,CPM;
}

Diagnostic_addresses {
    LSM: 1;
    CPM: 0x02;
}

Signals {
    RearFogLampInd:1,0,CEM,LSM;
    PositionLampInd:1,0,CEM,LSM;
    FrontFogLampInd:1,0,CEM,LSM;
    IgnitionKeyPos:3,0,CEM,LSM,CPM;
    LSMFuncIllum:4,0,CEM,LSM;
    LSMSymbolIllum:4,0,CEM,LSM;
    StartHeater:3,0,CEM,CPM;
    CPMReqB0:8,0,CEM,CPM;
    CPMReqB1:8,0,CEM,CPM;
    CPMReqB2:8,0,CEM,CPM;
    CPMReqB3:8,0,CEM,CPM;
    CPMReqB4:8,0,CEM,CPM;
    CPMReqB5:8,0,CEM,CPM;
    CPMReqB6:8,0,CEM,CPM;
    CPMReqB7:8,0,CEM,CPM;
    ReostatPos:4,0,LSM,CEM;
    HeadLampBeamLev:4,0,LSM,CEM;
    FrontFogLampSw:1,0,LSM,CEM;
    RearFogLampSw:1,0,LSM,CEM;
    MLSOff:1,0,LSM,CEM;
    MLSHeadLight:1,0,LSM,CEM;
    MLSPosLight:1,0,LSM,CEM;
    HBLSortHigh:1,0,LSM,CEM;
    HBLShortLow:1,0,LSM,CEM;
    ReoShortHigh:1,0,LSM,CEM;
    ReoShortLow:1,0,LSM,CEM;
    LSMHWPartNoB0:8,0,LSM,CEM;
    LSMHWPartNoB1:8,0,LSM,CEM;
    LSMHWPartNoB2:8,0,LSM,CEM;
    LSMHWPartNoB3:8,0,LSM,CEM;
    LSMSWPartNo:8,0,LSM,CEM;
    CPMOutputs:10,0,CPM,CEM;
    HeaterStatus:4,0,CPM,CEM;
    CPMGlowPlug:7,0,CPM,CEM;
    CPMFanPWM:8,0,CPM,CEM;
    WaterTempLow:8,0,CPM,CEM;
    WaterTempHigh:8,0,CPM,CEM;
    CPMFuelPump:7,0,CPM,CEM;
    CPMRunTime:13,0,CPM,CEM;
    FanIdealSpeed:8,0,CPM,CEM;
    FanMeasSpeed:8,0,CPM,CEM;
    CPMRespB0:1,0,CPM,CEM;
    CPMRespB1:1,0,CPM,CEM;
    CPMRespB2:1,0,CPM,CEM;
    CPMRespB3:1,0,CPM,CEM;
    CPMRespB4:1,0,CPM,CEM;
    CPMRespB5:1,0,CPM,CEM;
    CPMRespB6:1,0,CPM,CEM;
    CPMRespB7:1,0,CPM,CEM;
}

Frames {
    VL1_CEM_Frm1:32,CEM,3 { //The length of this frame is redefined to 3
        RearFogLampInd,0;
        PositionLampInd,1;
        FrontFogLampInd,2;
        IgnitionKeyPos,3;
        LSMFuncIllum,8;
        LSMSymbolIllum,12;
        StartHeater,16;
    }
    VL1_CEM_Frm2:48,CEM {
        CPMReqB0,0;
        CPMReqB1,8;
        CPMReqB2,16;
        CPMReqB3,24;
        CPMReqB4,32;
        CPMReqB5,40;
        CPMReqB6,48;
        CPMReqB7,56;
    }
    VL1_LSM_Frm1:33,LSM {
        ReostatPos,0;
        HeadLampBeamLev,4;
        FrontFogLampSw,8;
        RearFogLampSw,9;
        MLSOff,10;
        MLSHeadLight,11;
        MLSPosLight,12;
        HBLSortHigh,16;
        HBLShortLow,17;
        ReoShortHigh,18;
        ReoShortLow,19;
    }
    VL1_LSM_Frm2:49,LSM,6 { //The length of this frame is redefined to 5
        LSMHWPartNoB0,0;
        LSMHWPartNoB1,8;
        LSMHWPartNoB2,16;
        LSMHWPartNoB3,32;
        LSMSWPartNo,40;
    }
    VL1_CPM_Frm1:50,CPM {
        CPMOutputs,0;
        HeaterStatus,10;
        CPMGlowPlug,16;
        CPMFanPWM,24;
        WaterTempLow,32;
        WaterTempHigh,40;
        CPMFuelPump,56;
    }
    VL1_CPM_Frm2:34,CPM {
        CPMRunTime,0;
        FanIdealSpeed,16;
        FanMeasSpeed,24;
    }
    VL1_CPM_Frm3:51,CPM {
        CPMRespB0,0;
        CPMRespB1,8;
        CPMRespB2,16;
        CPMRespB3,24;
        CPMRespB4,32;
        CPMRespB5,40;
        CPMRespB6,48;
        CPMRespB7,56;
    }
}
Schedule_tables {
    VL1_ST1 {
        VL1_CEM_Frm1 delay 15 ms;
        VL1_LSM_Frm1 delay 15 ms;
        VL1_CPM_Frm1 delay 20 ms;
        VL1_CPM_Frm2 delay 20 ms;
    }
    VL1_ST2 {
        VL1_CEM_Frm1 delay 15 ms;
        VL1_CEM_Frm2 delay 20 ms;
        VL1_LSM_Frm1 delay 15 ms;
        VL1_LSM_Frm2 delay 20 ms;
        VL1_CEM_Frm1 delay 15 ms;
        VL1_CPM_Frm1 delay 20 ms;
        VL1_CPM_Frm2 delay 20 ms;
        VL1_LSM_Frm1 delay 15 ms;
        VL1_CPM_Frm3 delay 20 ms;
    }
}

Signal_groups {
    CPMReq:64 {
        CPMReqB0,0;
        CPMReqB1,8;
        CPMReqB2,16;
        CPMReqB3,24;
        CPMReqB4,32;
        CPMReqB5,40;
        CPMReqB6,48;
        CPMReqB7,56;
    }
    CPMResp:64 {
        CPMRespB0,0;
        CPMRespB1,8;
        CPMRespB2,16;
        CPMRespB3,24;
        CPMRespB4,32;
        CPMRespB5,40;
        CPMRespB6,48;
        CPMRespB7,56;
    }
}

Signal_encoding_types {
    State1 {
        logical_value,0,"off";
        logical_value,1,"on";
    }
    State2 {
        logical_value,0,"off";
        logical_value,1,"on";
        logical_value,2,"error";
        logical_value,3,"void";
    }
    Temp {
        physical_value,0,250,0.5,-40,"degree";
        physical_value,251,253,1,0,"undefined";
        logical_value,254,"out of range";
        logical_value,255,"error";
    }
    Speed {
        physical_value,0,65500,0.008,250,"km/h";
        physical_value,65501,65533,1,0,"undefined";
        logical_value,65534,"error";
        logical_value,65535,"void";
    }
}

Signal_representation {
    State1:RearFogLampInd,PositionLampInd,FrontFogLampInd;
    Temp:WaterTempLow,WaterTempHigh;
    Speed:FanIdealSpeed,FanMeasSpeed;
}`;
