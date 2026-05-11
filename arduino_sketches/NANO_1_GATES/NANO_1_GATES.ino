/* 
 * NANO-1: Kapı + Sensör Kontrol Yazılımı (V2.1)
 * Görev: Giriş/Çıkış kilitleri (Servo) ve Lazer Sensörler
 * Pinler:
 * - Pin 9, 10: Kapı Servoları
 * - Pin 12: Giriş Lazeri (D12)
 * - Pin 13: Çıkış Lazeri (D13)
 */
#include <Servo.h>

Servo g1, g2;
const int PIN_G1 = 9;
const int PIN_G2 = 10;
const int SENS_IN = 12;
const int SENS_OUT = 13;

// Sensör durum takibi
int lastInState = HIGH;
int lastOutState = HIGH;

void setup() {
  Serial.begin(9600);
  g1.attach(PIN_G1);
  g2.attach(PIN_G2);
  g1.write(0); 
  g2.write(0);

  // Sensör pinlerini PULLUP ile kur
  pinMode(SENS_IN, INPUT_PULLUP);
  pinMode(SENS_OUT, INPUT_PULLUP);
  
  Serial.println("ACK:NANO_1_READY_WITH_SENSORS");
}

void loop() {
  // --- Sensör Okuma (3V -> 0V düşüşünü yakala) ---
  int currentIn = digitalRead(SENS_IN);
  if (currentIn == LOW && lastInState == HIGH) {
    Serial.println("SENS:IN"); // Python'a haber ver
    delay(50); // Debounce
  }
  lastInState = currentIn;

  int currentOut = digitalRead(SENS_OUT);
  if (currentOut == LOW && lastOutState == HIGH) {
    Serial.println("SENS:OUT"); // Python'a haber ver
    delay(50); // Debounce
  }
  lastOutState = currentOut;

  // --- Komut İşleme ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
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
  }
}
