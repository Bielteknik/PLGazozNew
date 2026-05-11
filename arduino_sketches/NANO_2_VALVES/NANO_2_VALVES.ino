

// Valf rölelerinin bağlı olduğu pinler
const int pins[] = {2, 3, 4, 5, 6, 7, 8, 9, 10}; 
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
      // Örnek format: VALVE_CMD:1:ON
      int idx = cmd.indexOf(':', 10);
      if (idx == -1) return; // Hatalı format
      
      String id = cmd.substring(10, idx);
      String stateStr = cmd.substring(idx + 1);
      bool state = (stateStr == "ON");
      
      if (id == "ALL") {
        for(int i = 0; i < numValves; i++) {
          digitalWrite(pins[i], state ? LOW : HIGH); // ON = LOW, OFF = HIGH
        }
        Serial.print("ACK:VALVE:ALL:"); Serial.println(stateStr);
      } else {
        int vId = id.toInt();
        if(vId >= 1 && vId <= numValves) {
          digitalWrite(pins[vId-1], state ? LOW : HIGH); // ON = LOW, OFF = HIGH
          Serial.print("ACK:VALVE:"); Serial.print(vId);
          Serial.print(":"); Serial.println(stateStr);
        }
      }
    }
  }
}
