/* 
 * COMBINED NANO: Kapı + Valf Kontrol Yazılımı (V2.0)
 * Görev: Tek bir Nano üzerinden hem kapıları hem de valfleri yönetir.
 * Pin Çakışmalarını Önlemek İçin:
 * - Pin 9, 10: Kapı Servoları
 * - Pin 2, 3, 4, 5, 6, 7, 8: Valfler (7 adet)
 */
#include <Servo.h>

Servo g1, g2;
const int valvePins[] = {2, 3, 4, 5, 6, 7, 8}; 
const int numValves = 7;

void setup() {
  Serial.begin(9600);
  
  // Kapı Ayarları
  g1.attach(9); 
  g2.attach(10);
  g1.write(0); 
  g2.write(0);
  
  // Valf Ayarları
  for(int i = 0; i < numValves; i++) { 
    pinMode(valvePins[i], OUTPUT); 
    digitalWrite(valvePins[i], LOW); 
  }
  
  Serial.println("ACK:COMBINED_NANO_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    // --- Kapı Komutları ---
    if (cmd.startsWith("G1:")) {
      int pos = cmd.substring(3).toInt();
      g1.write(map(pos, 0, 100, 0, 90));
      Serial.print("ACK:G1:"); Serial.println(pos);
    } 
    else if (cmd.startsWith("G2:")) {
      int pos = cmd.substring(3).toInt();
      g2.write(map(pos, 0, 100, 0, 90));
      Serial.print("ACK:G2:"); Serial.println(pos);
    }
    
    // --- Valf Komutları ---
    else if (cmd.startsWith("VALVE_CMD:")) {
      int idx = cmd.indexOf(':', 10);
      if (idx == -1) return;
      
      String id = cmd.substring(10, idx);
      String stateStr = cmd.substring(idx + 1);
      bool state = (stateStr == "ON");
      
      if (id == "ALL") {
        for(int i = 0; i < numValves; i++) {
          digitalWrite(valvePins[i], state ? HIGH : LOW);
        }
        Serial.print("ACK:VALVE:ALL:"); Serial.println(stateStr);
      } else {
        int vId = id.toInt();
        if(vId >= 1 && vId <= numValves) {
          digitalWrite(valvePins[vId-1], state ? HIGH : LOW);
          Serial.print("ACK:VALVE:"); Serial.print(vId);
          Serial.print(":"); Serial.println(stateStr);
        }
      }
    }
  }
}
