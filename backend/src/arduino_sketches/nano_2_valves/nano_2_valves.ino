// NANO 2 - VALVES (VALFLER) KONTROLCÜSÜ
// 16 Kanal Röle Kartı için yazılmıştır.

// 16 valf için Arduino pin atamaları (Örnek D2-D17/A3)
const int relayPins[16] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, A0, A1, A2, A3};

void setup() {
  Serial.begin(115200);
  
  // Tüm röle pinlerini OUTPUT yap ve başlangıçta kapalı (HIGH) tut. 
  // (Not: Çoğu röle kartı Low-Level tetiklemelidir, yani LOW = AÇIK, HIGH = KAPALI)
  for (int i = 0; i < 16; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH);
  }
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.startsWith("VALVE_CMD:")) {
      int firstColon = cmd.indexOf(':');
      int secondColon = cmd.indexOf(':', firstColon + 1);
      
      String valveIdStr = cmd.substring(firstColon + 1, secondColon);
      String state = cmd.substring(secondColon + 1);
      
      if (valveIdStr == "ALL") {
        for (int i = 0; i < 16; i++) {
          digitalWrite(relayPins[i], (state == "ON") ? LOW : HIGH);
        }
      } else {
        int valveId = valveIdStr.toInt();
        if (valveId >= 1 && valveId <= 16) {
          int pinIndex = valveId - 1;
          digitalWrite(relayPins[pinIndex], (state == "ON") ? LOW : HIGH);
        }
      }
      Serial.println("ACK:" + cmd);
    }
  }
}
