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

// Başlangıç varsayılanları
GateConfig gate1 = {2, 3, 4, 1000, 500, 200, 0};
GateConfig gate2 = {5, 6, 7, 1000, 500, 200, 0};

AccelStepper stepper1(AccelStepper::DRIVER, gate1.stepPin, gate1.dirPin);
AccelStepper stepper2(AccelStepper::DRIVER, gate2.stepPin, gate2.dirPin);

void setup() {
  Serial.begin(115200);
  
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
    
    // G1_POS_100 veya G2_POS_0
    if (input.startsWith("G")) {
      int gateId = input.substring(1, 2).toInt();
      int posPercent = input.substring(7).toInt();
      
      long targetPos = (gateId == 1) ? map(posPercent, 0, 100, gate1.closePos, gate1.openPos) 
                                     : map(posPercent, 0, 100, gate2.closePos, gate2.openPos);
                                     
      if (gateId == 1) stepper1.moveTo(targetPos);
      else stepper2.moveTo(targetPos);
    }
    
    // CONF_G:ID:STEP:DIR:ENA:SPEED:ACCEL
    else if (input.startsWith("CONF_G")) {
      // Yapılandırma işleme...
      Serial.println("ACK_G_CONF");
    }
  }
  
  stepper1.run();
  stepper2.run();
}
