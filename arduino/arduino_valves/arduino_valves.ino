// Nano 2: Valf Sistemi (10 Adet Röle)

uint8_t valvePins[11]; // 1-10
bool isNormalClose[11]; 

void setup() {
  Serial.begin(115200);
  
  // D2 - D11 arası varsayılan
  for(int i=1; i<=10; i++) {
    valvePins[i] = i + 1; 
    isNormalClose[i] = false;
    pinMode(valvePins[i], OUTPUT);
    digitalWrite(valvePins[i], HIGH); 
  }
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    // V1_ON, V2_OFF ...
    if (input.startsWith("V")) {
      int underscoreIdx = input.indexOf('_');
      int valveId = input.substring(1, underscoreIdx).toInt();
      String state = input.substring(underscoreIdx + 1);
      
      if (valveId >= 1 && valveId <= 10) {
        bool isOn = (state == "ON");
        bool pinLevel = isOn ? LOW : HIGH; // Active Low röle varsayımı
        if (isNormalClose[valveId]) pinLevel = !pinLevel;
        
        digitalWrite(valvePins[valveId], pinLevel);
      }
    }
    
    // CONF_V:ID:PIN:TYPE
    else if (input.startsWith("CONF_V")) {
      // Yapılandırma işleme...
      Serial.println("ACK_V_CONF");
    }
  }
}
