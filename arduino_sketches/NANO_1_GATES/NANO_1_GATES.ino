/* 
 * NANO-1: Kapı Kontrol Yazılımı (V2.0)
 * Görev: Giriş ve Çıkış kilitlerini (Servo motorlar) kontrol eder.
 * Protokol: G1:100 (Aç), G1:0 (Kapat)
 */
#include <Servo.h>

Servo g1, g2;
const int PIN_G1 = 9;  // Giriş Kapısı Sinyal Pini
const int PIN_G2 = 10; // Çıkış Kapısı Sinyal Pini

void setup() {
  Serial.begin(9600);
  g1.attach(PIN_G1);
  g2.attach(PIN_G2);
  
  // Başlangıç durumu: Kapalı
  g1.write(0); 
  g2.write(0);
  
  Serial.println("ACK:NANO_1_GATES_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    // Giriş Kapısı Kontrolü
    if (cmd.startsWith("G1:")) {
      int pos = cmd.substring(3).toInt();
      // 100 gelirse 90 derece (açık), 0 gelirse 0 derece (kapalı)
      int angle = map(pos, 0, 100, 0, 90);
      g1.write(angle);
      Serial.print("ACK:G1:"); Serial.println(pos);
    } 
    // Çıkış Kapısı Kontrolü
    else if (cmd.startsWith("G2:")) {
      int pos = cmd.substring(3).toInt();
      int angle = map(pos, 0, 100, 0, 90);
      g2.write(angle);
      Serial.print("ACK:G2:"); Serial.println(pos);
    }
  }
}
