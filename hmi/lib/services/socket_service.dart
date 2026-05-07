import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

class SocketService with ChangeNotifier {
  late socket_io.Socket socket;
  Map<String, dynamic> productionData = {
    'inputCount': 0,
    'outputCount': 0,
    'state': 'BEKLEMEDE',
    'mode': 'MANUEL',
  };
  Map<int, bool> sensorStates = {};

  SocketService() {
    _initSocket();
  }

  void _initSocket() {
    // Raspberry Pi IP adresine veya localhost'a bağlanır
    socket = socket_io.io('http://localhost:5001', 
      socket_io.OptionBuilder()
        .setTransports(['websocket'])
        .enableAutoConnect()
        .build()
    );

    socket.onConnect((_) {
      debugPrint('Python Sunucusuna Bağlanıldı');
    });


    socket.on('production_update', (data) {
      productionData = data;
      notifyListeners();
    });

    socket.on('sensor_update', (data) {
      // Örn: {17: true, 27: false, ...}
      data.forEach((key, value) {
        sensorStates[int.parse(key)] = value;
      });
      notifyListeners();
    });
  }

  void sendCommand(String event, dynamic data) {
    socket.emit(event, data);
  }
}
