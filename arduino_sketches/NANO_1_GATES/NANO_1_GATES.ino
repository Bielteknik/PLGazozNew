/* 
 * NANO-1: Kilit Kontrol (NEMA 17) + Lazer Sensör (V3.1)
 * Kimlik: GatesNano
 */

#define HARDWARE_ID "GatesNano"

#define STEP1_PIN 2
#define DIR1_PIN 5
#define STEP2_PIN 3
#define DIR2_PIN 6
#define EN_PIN 8

#define SENS_IN 12
#define SENS_OUT 13

// Motor States
long targetSteps1 = 0, currentSteps1 = 0;
long targetSteps2 = 0, currentSteps2 = 0;
bool dir1 = true, dir2 = true;
unsigned long lastStepMicros1 = 0, lastStepMicros2 = 0;
int stepDelay = 800;
unsigned long lastMoveTime = 0;
const long DEFAULT_STEPS = 1000;

int lastInState = HIGH;
int lastOutState = HIGH;

void enableDriver() { digitalWrite(EN_PIN, LOW); }
void disableDriver() { digitalWrite(EN_PIN, HIGH); }

void setup() {
  Serial.begin(9600);
  
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);
  pinMode(STEP2_PIN, OUTPUT);
  pinMode(DIR2_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  
  pinMode(SENS_IN, INPUT_PULLUP);
  pinMode(SENS_OUT, INPUT_PULLUP);
  
  disableDriver();
  Serial.print("ID:"); Serial.println(HARDWARE_ID);
}

void loop() {
  unsigned long now = millis();
  unsigned long nowMicros = micros();

  // --- SENSÖR TAKİBİ (Daha Hassas Okuma) ---
  int currentIn = digitalRead(SENS_IN);
  if (currentIn == LOW && lastInState == HIGH) {
    Serial.print(HARDWARE_ID); Serial.println(":P1:IN");
  }
  lastInState = currentIn;

  int currentOut = digitalRead(SENS_OUT);
  if (currentOut == LOW && lastOutState == HIGH) {
    Serial.print(HARDWARE_ID); Serial.println(":P1:OUT");
  }
  lastOutState = currentOut;

  // --- MOTOR 1 KONTROL (Non-blocking) ---
  if (currentSteps1 < targetSteps1) {
    if (nowMicros - lastStepMicros1 >= stepDelay) {
      digitalWrite(STEP1_PIN, HIGH);
      delayMicroseconds(2); // Minimum pulse width
      digitalWrite(STEP1_PIN, LOW);
      lastStepMicros1 = nowMicros;
      currentSteps1++;
      lastMoveTime = now;
    }
  }

  // --- MOTOR 2 KONTROL (Non-blocking) ---
  if (currentSteps2 < targetSteps2) {
    if (nowMicros - lastStepMicros2 >= stepDelay) {
      digitalWrite(STEP2_PIN, HIGH);
      delayMicroseconds(2);
      digitalWrite(STEP2_PIN, LOW);
      lastStepMicros2 = nowMicros;
      currentSteps2++;
      lastMoveTime = now;
    }
  }

  // --- KOMUT İŞLEME ---
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "IDENTIFY" || cmd == "STATUS") {
      Serial.print("ID:"); Serial.println(HARDWARE_ID);
    }
    else if (cmd.startsWith("G1:")) {
      int val = cmd.substring(3).toInt();
      dir1 = (val > 0);
      digitalWrite(DIR1_PIN, dir1);
      targetSteps1 = (abs(val) <= 1) ? DEFAULT_STEPS : abs(val);
      currentSteps1 = 0;
      enableDriver();
      Serial.print(HARDWARE_ID); Serial.print(":ACK:G1:"); Serial.println(val);
    }
    else if (cmd.startsWith("G2:")) {
      int val = cmd.substring(3).toInt();
      dir2 = (val > 0);
      digitalWrite(DIR2_PIN, dir2);
      targetSteps2 = (abs(val) <= 1) ? DEFAULT_STEPS : abs(val);
      currentSteps2 = 0;
      enableDriver();
      Serial.print(HARDWARE_ID); Serial.print(":ACK:G2:"); Serial.println(val);
    }
    else if (cmd.startsWith("s")) {
      stepDelay = cmd.substring(1).toInt();
      Serial.print(HARDWARE_ID); Serial.print(":ACK:SPEED:"); Serial.println(stepDelay);
    }
  }

  // --- OTOMATİK UYKU ---
  if (currentSteps1 >= targetSteps1 && currentSteps2 >= targetSteps2) {
    if (now - lastMoveTime > 1000) {
      disableDriver();
    }
  }
}
