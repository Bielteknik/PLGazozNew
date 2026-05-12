/* 
 * NANO-2: Valf Kontrolü (V3.0)
 * Kimlik: NANO-2
 */
#define HARDWARE_ID "NANO-2"

const int valvePins[] = {2, 3, 4, 5, 6, 7, 8, 11, 12}; // 9 Valf
const int numValves = 9;

void setup() {
  Serial.begin(9600);
  
  for(int i = 0; i < numValves; i++) { 
    pinMode(valvePins[i], OUTPUT); 
    digitalWrite(valvePins[i], HIGH); // Kapalı (Active-Low)
  }
  
  Serial.print("ID:"); Serial.println(HARDWARE_ID);
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "IDENTIFY") {
      Serial.print("ID:"); Serial.println(HARDWARE_ID);
    }
    else if (cmd.startsWith("VALVE_CMD:")) {
      int idx = cmd.indexOf(':', 10);
      if (idx == -1) return;
      
      String vTag = cmd.substring(10, idx);
      String stateStr = cmd.substring(idx + 1);
      bool state = (stateStr == "ON");
      
      if (vTag == "ALL") {
        for(int i = 0; i < numValves; i++) {
          digitalWrite(valvePins[i], state ? LOW : HIGH);
        }
        send_ack("VALVE:ALL", stateStr);
      } else {
        int vNum = vTag.toInt();
        // Basit eşleştirme: vNum 10 ise valvePins[0] vb. (Arayüz ID'lerine göre)
        int pinIdx = -1;
        if (vNum >= 10 && vNum <= 18) pinIdx = vNum - 10;
        
        if(pinIdx >= 0 && pinIdx < numValves) {
          digitalWrite(valvePins[pinIdx], state ? LOW : HIGH);
          send_ack("VALVE:" + String(vNum), stateStr);
        }
      }
    }
  }
}

void send_ack(String cmd, String val) {
  Serial.print(HARDWARE_ID);
  Serial.print(":ACK:");
  Serial.print(cmd);
  Serial.print(":");
  Serial.println(val);
}
