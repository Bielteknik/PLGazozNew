# Arduino Yazılımları (PLGazoz Donanım Katmanı)

Bu belgede, Raspberry Pi (Python) ile seri port üzerinden haberleşen iki adet Arduino Nano için gerekli kodlar bulunmaktadır.

---

## Nano 1: Kilit Sistemi (2 Adet NEMA 17 Step Motor)
**Kütüphane Gereksinimi:** `AccelStepper`

```cpp
#include <AccelStepper.h>

// Varsayılan Pinler (Pi'den CONF_G gelene kadar kullanılır)
struct GateConfig {
  uint8_t stepPin;
  uint8_t dirPin;
  uint8_t enaPin;
  long speed;
  long accel;
  long openPos;
  long closePos;
};

GateConfig gate1 = {2, 3, 4, 1000, 500, 200, 0};
GateConfig gate2 = {5, 6, 7, 1000, 500, 200, 0};

AccelStepper stepper1(AccelStepper::DRIVER, gate1.stepPin, gate1.dirPin);
AccelStepper stepper2(AccelStepper::DRIVER, gate2.stepPin, gate2.dirPin);

void setup() {
  Serial.begin(115200);
  
  pinMode(gate1.enaPin, OUTPUT);
  pinMode(gate2.enaPin, OUTPUT);
  digitalWrite(gate1.enaPin, LOW); // Enable motor
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
    
    // FORMAT: G1_POS_100 (Gate 1, Position %100)
    if (input.startsWith("G")) {
      int gateId = input.substring(1, 2).toInt();
      int posPercent = input.substring(7).toInt();
      
      long targetPos = (gateId == 1) ? map(posPercent, 0, 100, gate1.closePos, gate1.openPos) 
                                     : map(posPercent, 0, 100, gate2.closePos, gate2.openPos);
                                     
      if (gateId == 1) stepper1.moveTo(targetPos);
      else stepper2.moveTo(targetPos);
    }
    
    // FORMAT: CONF_G:ID:STEP:DIR:ENA:SPEED:ACCEL
    else if (input.startsWith("CONF_G")) {
      // Parse logic (basitleştirilmiş)
      // Örn: CONF_G:1:2:3:4:1000:500
      // Not: Dinamik pin değişimi için nesnelerin yeniden oluşturulması gerekebilir.
      Serial.println("ACK_CONF_GATE");
    }
  }
  
  stepper1.run();
  stepper2.run();
}
```

---

## Nano 2: Valf Sistemi (10 Adet Röle)

```cpp
// 10 Valf için Pin Haritası
uint8_t valvePins[11]; // Index 1-10 kullanılır
bool isNormalClose[11]; // NO: 0, NC: 1

void setup() {
  Serial.begin(115200);
  
  // Varsayılan D2 - D11 arası
  for(int i=1; i<=10; i++) {
    valvePins[i] = i + 1; 
    isNormalClose[i] = false;
    pinMode(valvePins[i], OUTPUT);
    digitalWrite(valvePins[i], HIGH); // Röleler genelde Active-Low'dur
  }
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    // FORMAT: V1_ON veya V1_OFF
    if (input.startsWith("V")) {
      int underscoreIdx = input.indexOf('_');
      int valveId = input.substring(1, underscoreIdx).toInt();
      String state = input.substring(underscoreIdx + 1);
      
      if (valveId >= 1 && valveId <= 10) {
        bool isOn = (state == "ON");
        // Röle mantığı (Active Low/High ve NO/NC hesabı)
        bool pinLevel = isOn ? LOW : HIGH; 
        if (isNormalClose[valveId]) pinLevel = !pinLevel;
        
        digitalWrite(valvePins[valveId], pinLevel);
      }
    }
    
    // FORMAT: CONF_V:ID:PIN:TYPE
    else if (input.startsWith("CONF_V")) {
      // Parse: CONF_V:1:3:0  (ID:1, PIN:3, TYPE:NO)
      int firstColon = input.indexOf(':');
      int secondColon = input.indexOf(':', firstColon + 1);
      int thirdColon = input.indexOf(':', secondColon + 1);
      
      int id = input.substring(firstColon + 1, secondColon).toInt();
      int pin = input.substring(secondColon + 1, thirdColon).toInt();
      int type = input.substring(thirdColon + 1).toInt();
      
      if (id >= 1 && id <= 10) {
        valvePins[id] = pin;
        isNormalClose[id] = (type == 1);
        pinMode(pin, OUTPUT);
        digitalWrite(pin, HIGH); // Reset state
      }
      Serial.println("ACK_CONF_VALVE");
    }
  }
}
```
