/* 
 * NANO-1: Kilit ve Sensör Kontrolü (V3.0)
 * Kimlik: NANO-1
 */
#include <Servo.h>

#define HARDWARE_ID "GatesNano"

Servo g1, g2;
const int inSensorPin = 17; // Örnek pin
const int outSensorPin = 18; // Örnek pin

void setup() {
  Serial.begin(9600);
  
  g1.attach(9); 
  g2.attach(10);
  g1.write(0); 
  g2.write(0);
  
  pinMode(inSensorPin, INPUT_PULLUP);
  pinMode(outSensorPin, INPUT_PULLUP);
  
  Serial.print("ID:"); Serial.println(HARDWARE_ID);
}

void loop() {
  // --- Kimlik Sorgusu ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "IDENTIFY" || cmd == "STATUS") {
      Serial.print("ID:"); Serial.println(HARDWARE_ID);
      if (cmd == "STATUS") {
        Serial.print(HARDWARE_ID); Serial.println(":STAT:READY");
      }
    }
    else if (cmd.startsWith("G1:")) {
      int pos = cmd.substring(3).toInt();
      g1.write(map(pos, 0, 100, 0, 90));
      send_ack("G1", String(pos));
    } 
    else if (cmd.startsWith("G2:")) {
      int pos = cmd.substring(3).toInt();
      g2.write(map(pos, 0, 100, 0, 90));
      send_ack("G2", String(pos));
    }
  }

  // --- Sensör Okuma (Parazit Filtreli) ---
  check_sensor(inSensorPin, "P1");
  check_sensor(outSensorPin, "P2");
}

void send_ack(String cmd, String val) {
  Serial.print(HARDWARE_ID);
  Serial.print(":ACK:");
  Serial.print(cmd);
  Serial.print(":");
  Serial.println(val);
}

void check_sensor(int pin, String label) {
  static unsigned long lastTime[] = {0, 0};
  int idx = (pin == inSensorPin) ? 0 : 1;
  
  if (digitalRead(pin) == LOW) { // Tetiklendi
    if (millis() - lastTime[idx] > 500) { // 500ms Debounce
      Serial.print(HARDWARE_ID);
      Serial.print(":");
      Serial.print(label);
      Serial.print(":");
      Serial.println(pin);
      lastTime[idx] = millis();
    }
  }
}
