#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>

// Donanım Yapılandırması
#define DEVICE_ID "ValfNano"
#define I2C_ADDR 0x08  // ValfNano I2C adresi

const int relayPins[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
const int numPins = sizeof(relayPins) / sizeof(relayPins[0]);

// Tamponlar
String serialBuffer = "";
volatile char spiBuffer[32] = "";
volatile byte spiIndex = 0;
volatile char spiSendBuffer[32] = DEVICE_ID "\n";
volatile byte spiSendIndex = 0;

volatile byte i2cRegister = 0;
char i2cSendBuffer[32] = DEVICE_ID "\n";
byte i2cSendIndex = 0;

void setup() {
  // Röle Pinleri Çıkış Olarak Ayarlanıyor
  for (int i = 0; i < numPins; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], LOW); // Başlangıçta hepsi kapalı (Active-High varsayımı)
  }

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
  
  // SPI slave veri gönderimi (Full-Duplex el sıkışma için)
  SPDR = spiSendBuffer[spiSendIndex];
  spiSendIndex++;
  if (spiSendBuffer[spiSendIndex] == '\0' || spiSendIndex >= sizeof(spiSendBuffer)) {
    spiSendIndex = 0;
  }
}

void loop() {
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

// I2C Veri Alma
void receiveI2C(int numBytes) {
  String cmd = "";
  if (Wire.available()) {
    byte firstByte = Wire.read();
    if (firstByte == 0x99) {
      i2cRegister = 0x99; // IDENTIFY talebi
      i2cSendIndex = 0;
      return;
    }
    
    cmd += (char)firstByte;
    while (Wire.available()) {
      cmd += (char)Wire.read();
    }
    processCommand(cmd, "I2C");
  }
}

// I2C Yanıt Gönderme
void requestI2C() {
  if (i2cRegister == 0x99) {
    // Kimlik gönder
    Wire.write(DEVICE_ID "\n");
    i2cRegister = 0;
  } else {
    // Durum veya standart yanıt
    Wire.write("ACK\n");
  }
}

// Komut İşleme Fonksiyonu
void processCommand(String cmd, String source) {
  cmd.trim();
  if (cmd == "IDENTIFY" || cmd == "ID") {
    sendResponse("ID:" DEVICE_ID, source);
    return;
  }

  if (cmd.startsWith("VALVE_CMD:")) {
    // Format: VALVE_CMD:pin:state (Örn: VALVE_CMD:2:ON, VALVE_CMD:ALL:OFF)
    int secondColon = cmd.indexOf(':', 10);
    if (secondColon != -1) {
      String pinStr = cmd.substring(10, secondColon);
      String stateStr = cmd.substring(secondColon + 1);

      if (pinStr == "ALL" && stateStr == "OFF") {
        for (int i = 0; i < numPins; i++) {
          digitalWrite(relayPins[i], LOW);
        }
        sendResponse(DEVICE_ID ":ACK:ALL:OFF", source);
      } else {
        int pin = pinStr.toInt();
        if (pin >= 2 && pin <= 13) {
          if (stateStr == "ON") {
            digitalWrite(pin, HIGH);
            sendResponse(DEVICE_ID ":ACK:" + String(pin) + ":ON", source);
          } else if (stateStr == "OFF") {
            digitalWrite(pin, LOW);
            sendResponse(DEVICE_ID ":ACK:" + String(pin) + ":OFF", source);
          }
        }
      }
    }
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
