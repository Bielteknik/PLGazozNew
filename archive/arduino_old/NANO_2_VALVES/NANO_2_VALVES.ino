// Valf rölelerinin bağlı olduğu pinler
const int pins[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}; 
const int numValves = 9;

void setup() {
  Serial.begin(9600);
  
  for(int i = 0; i < numValves; i++) { 
    pinMode(pins[i], OUTPUT); 
    digitalWrite(pins[i], HIGH); // Başlangıçta hepsi KAPALI (Active Low röleler için HIGH = KAPALI)
  }
  
  Serial.println("ACK:NANO_2_VALVES_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.startsWith("VALVE_CMD:")) {
      // Örnek format: VALVE_CMD:2:ON (2 burada fiziksel pin numarasıdır)
      int idx = cmd.lastIndexOf(':');
      if (idx == -1) return;
      
      String pinStr = cmd.substring(10, idx);
      String stateStr = cmd.substring(idx + 1);
      bool state = (stateStr == "ON");
      
      if (pinStr == "ALL") {
        // Tanımlı tüm pinleri kapat
        for(int i = 0; i < (sizeof(pins)/sizeof(pins[0])); i++) {
          pinMode(pins[i], OUTPUT);
          digitalWrite(pins[i], HIGH); // Active-Low: HIGH = KAPALI
        }
        Serial.print("ACK:VALVE:ALL:"); Serial.println(stateStr);
      } else {
        int pin = pinStr.toInt();
        if(pin >= 2 && pin <= 53) { // Geçerli pin aralığı
          pinMode(pin, OUTPUT);
          digitalWrite(pin, state ? LOW : HIGH); // ON = LOW, OFF = HIGH
          Serial.print("ACK:VALVE:PIN:"); Serial.print(pin);
          Serial.print(":"); Serial.println(stateStr);
        }
      }
    }
  }
}
