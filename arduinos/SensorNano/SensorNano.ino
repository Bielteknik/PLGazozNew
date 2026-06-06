#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>

// Donanım Yapılandırması
#define DEVICE_ID "SensorNano"
#define I2C_ADDR 0x09  // SensorNano I2C adresi

const int inputLaserPin = 2;   // Giriş Lazeri (P1:IN)
const int outputLaserPin = 3;  // Çıkış Lazeri (P1:OUT)

// Debounce Değişkenleri
unsigned long lastInputDebounce = 0;
unsigned long lastOutputDebounce = 0;
const int debounceDelay = 50;  // 50ms debounce

int lastInputState = HIGH;
int lastOutputState = HIGH;

// Tamponlar
String serialBuffer = "";
volatile char spiBuffer[32] = "";
volatile byte spiIndex = 0;
volatile char spiSendBuffer[32] = DEVICE_ID "\n";
volatile byte spiSendIndex = 0;

volatile byte i2cRegister = 0;
char i2cSendBuffer[64] = "";
byte i2cSendIndex = 0;

void setup() {
  // Lazer Sensör Pinleri Giriş Olarak Ayarlanıyor
  pinMode(inputLaserPin, INPUT_PULLUP);
  pinMode(outputLaserPin, INPUT_PULLUP);

  // 1. Seri Port Başlatma
  Serial.begin(115200);

  // 2. I2C Slave Başlatma
  Wire.begin(I2C_ADDR);
  Wire.onReceive(receiveI2C);
  Wire.onRequest(requestI2C);

  // 3. SPI Slave Başlatma
  pinMode(MISO, OUTPUT);
  SPCR |= _BV(SPE); // SPI'yi slave moduna al
  SPI.attachInterrupt(); // SPI kesmesini aktif et
}

// SPI Kesme Servisi (SPI Interrupt)
ISR(SPI_STC_vect) {
  byte c = SPDR;
  if (spiIndex < sizeof(spiBuffer) - 1) {
    spiBuffer[spiIndex++] = c;
    if (c == '\n') {
      spiBuffer[spiIndex] = '\0';
      processCommand(String((char*)spiBuffer), "SPI");
      spiIndex = 0;
    }
  } else {
    spiIndex = 0;
  }
  
  // SPI slave veri gönderimi (Full-Duplex)
  SPDR = spiSendBuffer[spiSendIndex];
  spiSendIndex++;
  if (spiSendBuffer[spiSendIndex] == '\0' || spiSendIndex >= sizeof(spiSendBuffer)) {
    spiSendIndex = 0;
    // Gönderim bittikten sonra tamponu temizle (yeni trigger beklesin)
    strncpy((char*)spiSendBuffer, "", sizeof(spiSendBuffer));
  }
}

void loop() {
  // Lazer sensörlerin durumlarını oku
  int currentInputVal = digitalRead(inputLaserPin);
  int currentOutputVal = digitalRead(outputLaserPin);
  unsigned long now = millis();

  // Giriş Lazeri Kontrolü (HIGH -> LOW geçişi algılanır)
  if (currentInputVal != lastInputState) {
    if ((now - lastInputDebounce) > debounceDelay) {
      lastInputDebounce = now;
      lastInputState = currentInputVal;
      if (currentInputVal == LOW) {
        triggerSensor("IN");
      }
    }
  }

  // Çıkış Lazeri Kontrolü (HIGH -> LOW geçişi algılanır)
  if (currentOutputVal != lastOutputState) {
    if ((now - lastOutputDebounce) > debounceDelay) {
      lastOutputDebounce = now;
      lastOutputState = currentOutputVal;
      if (currentOutputVal == LOW) {
        triggerSensor("OUT");
      }
    }
  }

  // Seri Port Veri Okuma
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(serialBuffer, "SERIAL");
      serialBuffer = "";
    } else if (c != '\r') {
      serialBuffer += c;
    }
  }
}

// Sensör Tetikleme Bildirimi
void triggerSensor(String type) {
  String resp = DEVICE_ID ":P1:" + type + "\n";
  
  // Seri Port'a yaz
  Serial.print(resp);

  // I2C Tamponuna ekle (I2C Okuma işlemi için sıraya al)
  strncpy(i2cSendBuffer, resp.c_str(), sizeof(i2cSendBuffer));
  i2cSendIndex = 0;

  // SPI Tamponuna ekle
  strncpy((char*)spiSendBuffer, resp.c_str(), sizeof(spiSendBuffer));
  spiSendIndex = 0;
}

// I2C Veri Alma
void receiveI2C(int numBytes) {
  String cmd = "";
  if (Wire.available()) {
    byte firstByte = Wire.read();
    if (firstByte == 0x99) {
      i2cRegister = 0x99; // IDENTIFY talebi
      return;
    }
    
    cmd += (char)firstByte;
    while (Wire.available()) {
      cmd += (char)Wire.read();
    }
    processCommand(cmd, "I2C");
  }
}

// I2C Yanıt Gönderme (Master Polling)
void requestI2C() {
  if (i2cRegister == 0x99) {
    Wire.write(DEVICE_ID "\n");
    i2cRegister = 0;
  } else {
    // Tamponda okunmayı bekleyen sensör verisi varsa onu gönder
    if (strlen(i2cSendBuffer) > 0) {
      Wire.write(i2cSendBuffer);
      // Gönderildikten sonra temizle
      strncpy(i2cSendBuffer, "", sizeof(i2cSendBuffer));
    } else {
      // Bekleme durumunda boş veri
      Wire.write("");
    }
  }
}

// Komut İşleme Fonksiyonu
void processCommand(String cmd, String source) {
  cmd.trim();
  if (cmd == "IDENTIFY" || cmd == "ID") {
    sendResponse("ID:" DEVICE_ID, source);
    return;
  }
}

// Yanıt Gönderme Fonksiyonu
void sendResponse(String resp, String source) {
  if (source == "SERIAL") {
    Serial.println(resp);
  } else if (source == "I2C") {
    strncpy(i2cSendBuffer, (resp + "\n").c_str(), sizeof(i2cSendBuffer));
    i2cSendIndex = 0;
  } else if (source == "SPI") {
    strncpy((char*)spiSendBuffer, (resp + "\n").c_str(), sizeof(spiSendBuffer));
    spiSendIndex = 0;
  }
}
