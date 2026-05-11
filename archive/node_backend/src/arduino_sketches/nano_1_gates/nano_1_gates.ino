#include <AccelStepper.h>

// Nano 1: Kilit Sistemi (2 Adet NEMA 17 Step Motor)
// AccelStepper kütüphanesi gereklidir.

struct GateConfig {
  uint8_t stepPin;
  uint8_t dirPin;
  uint8_t enaPin;
  long speed;
  long accel;
  long openPos;
  long closePos;
};

// Başlangıç varsayılanları (Giriş Kapısı: 2/5, Çıkış Kapısı: 3/6, Enable: 8)
GateConfig gate1 = {2, 5, 8, 1000, 500, -650, 0}; // Geri yönde 650 adım açılır, 0 da kapanır
GateConfig gate2 = {3, 6, 8, 1000, 500, -650, 0};

AccelStepper stepper1(AccelStepper::DRIVER, gate1.stepPin, gate1.dirPin);
AccelStepper stepper2(AccelStepper::DRIVER, gate2.stepPin, gate2.dirPin);

void setup() {
  Serial.begin(9600);
  
  pinMode(gate1.enaPin, OUTPUT);
  pinMode(gate2.enaPin, OUTPUT);
  digitalWrite(gate1.enaPin, LOW); 
  digitalWrite(gate2.enaPin, LOW);
  
  stepper1.setMaxSpeed(gate1.speed);
  stepper1.setAcceleration(gate1.accel);
  stepper2.setMaxSpeed(gate2.speed);
  stepper2.setAcceleration(gate2.accel);
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    // G1:100 (Kapı 1 %100 Açık), G1:0 (Kapı 1 %0 Kapalı)
    if (input.startsWith("G")) {
      int gateId = input.substring(1, 2).toInt();
      int posPercent = input.substring(3).toInt();
      
      // Hareket başlamadan önce sürücüleri aktif et (ENA -> LOW)
      digitalWrite(gate1.enaPin, LOW); 
      digitalWrite(gate2.enaPin, LOW);
      
      long targetPos = (gateId == 1) ? map(posPercent, 0, 100, gate1.closePos, gate1.openPos) 
                                     : map(posPercent, 0, 100, gate2.closePos, gate2.openPos);
                                     
      if (gateId == 1) stepper1.moveTo(targetPos);
      else stepper2.moveTo(targetPos);

      Serial.println("ACK:" + input);
    }
    
    // FORMAT: CONF_G:ID:STEP:DIR:ENA:SPEED:ACCEL:OPEN:CLOSE
    else if (input.startsWith("CONF_G")) {
      int first = input.indexOf(':');
      int s1 = input.indexOf(':', first + 1);
      int s2 = input.indexOf(':', s1 + 1);
      int s3 = input.indexOf(':', s2 + 1);
      int s4 = input.indexOf(':', s3 + 1);
      int s5 = input.indexOf(':', s4 + 1);
      int s6 = input.indexOf(':', s5 + 1);
      int s7 = input.indexOf(':', s6 + 1);

      int id = input.substring(first + 1, s1).toInt();
      uint8_t step = input.substring(s1 + 1, s2).toInt();
      uint8_t dir = input.substring(s2 + 1, s3).toInt();
      uint8_t ena = input.substring(s3 + 1, s4).toInt();
      long speed = input.substring(s4 + 1, s5).toInt();
      long accel = input.substring(s5 + 1, s6).toInt();
      long openP = input.substring(s6 + 1, s7).toInt();
      long closeP = input.substring(s7 + 1).toInt();

      if (id == 1) {
        gate1 = {step, dir, ena, speed, accel, openP, closeP};
        stepper1.setMaxSpeed(gate1.speed);
        stepper1.setAcceleration(gate1.accel);
        pinMode(gate1.enaPin, OUTPUT);
      } else if (id == 2) {
        gate2 = {step, dir, ena, speed, accel, openP, closeP};
        stepper2.setMaxSpeed(gate2.speed);
        stepper2.setAcceleration(gate2.accel);
        pinMode(gate2.enaPin, OUTPUT);
      }
      Serial.println("ACK_G_CONF");
    }
  }
  
  // Motorları çalıştır
  stepper1.run();
  stepper2.run();

  // Eğer her iki motor da hedefe ulaştıysa, cızırtıyı ve ısınmayı kesmek için sürücüleri kapat (ENA -> HIGH)
  if (stepper1.distanceToGo() == 0 && stepper2.distanceToGo() == 0) {
    digitalWrite(gate1.enaPin, HIGH); 
    digitalWrite(gate2.enaPin, HIGH);
  }
}
