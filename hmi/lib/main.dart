import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'services/socket_service.dart';
import 'widgets/stat_card.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SocketService()),
      ],
      child: const PLGazozHMI(),
    ),
  );
}

class PLGazozHMI extends StatelessWidget {
  const PLGazozHMI({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PLGAZOZ v2.5',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF010409),
        primaryColor: const Color(0xFF1F6FEB),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      ),
      home: const MainLayout(),
    );
  }
}

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context);

    return Scaffold(
      body: Row(
        children: [
          // Sidebar
          Container(
            width: 220,
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              border: Border(right: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
            ),
            child: Column(
              children: [
                const SizedBox(height: 50),
                Text('PLGAZOZ', 
                  style: GoogleFonts.orbitron(
                    fontSize: 24, fontWeight: FontWeight.bold, color: const Color(0xFF58A6FF), letterSpacing: 2,
                  )
                ),
                const SizedBox(height: 50),
                _buildNavItem(0, 'ANA PANEL', Icons.dashboard_outlined),
                _buildNavItem(1, 'MANUEL KONTROL', Icons.settings_remote_outlined),
                _buildNavItem(2, 'REÇETELER', Icons.receipt_long_outlined),
                _buildNavItem(3, 'AYARLAR', Icons.admin_panel_settings_outlined),
                const Spacer(),
                const Padding(
                  padding: EdgeInsets.all(20.0),
                  child: Text('SİSTEM ÇEVRİMİÇİ', style: TextStyle(color: Color(0xFF3FB950), fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          // Dynamic Body
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(30),
              child: _buildBody(_selectedIndex, socket),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, String label, IconData icon) {
    bool isSelected = _selectedIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        decoration: BoxDecoration(color: isSelected ? Colors.white.withValues(alpha: 0.05) : Colors.transparent),
        child: Row(
          children: [
            Icon(icon, color: isSelected ? const Color(0xFF58A6FF) : Colors.grey, size: 20),
            const SizedBox(width: 15),
            Text(label, style: TextStyle(color: isSelected ? Colors.white : Colors.grey, fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(int index, SocketService socket) {
    switch (index) {
      case 0: return _buildDashboard(socket);
      case 1: return _buildManualControl(socket);
      case 2: return _buildRecipes(socket);
      case 3: return _buildSettings(socket);
      default: return _buildDashboard(socket);
    }
  }

  // --- ANA PANEL ---
  Widget _buildDashboard(SocketService socket) {
    final data = socket.productionData;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('SİSTEM GENEL DURUMU', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF8B949E))),
            Text('MOD: ${data['mode']}', style: const TextStyle(color: Color(0xFF58A6FF), fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 30),
        Expanded(
          child: Row(
            children: [
              Expanded(
                flex: 1,
                child: Column(
                  children: [
                    StatCard(title: 'Giriş Sayısı', value: '${data['inputCount']}', color: const Color(0xFF58A6FF), icon: Icons.login),
                    const SizedBox(height: 20),
                    StatCard(title: 'Çıkış Sayısı', value: '${data['outputCount']}', color: const Color(0xFF3FB950), icon: Icons.logout),
                  ],
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                flex: 2,
                child: _buildProcessCard(socket),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProcessCard(SocketService socket) {
    final state = socket.productionData['state'];
    return Container(
      padding: const EdgeInsets.all(30),
      decoration: BoxDecoration(color: const Color(0xFF161B22), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.05))),
      child: Column(
        children: [
          Text('CANLI SÜREÇ TAKİBİ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
          const SizedBox(height: 40),
          Text(state.toString().replaceAll('_', ' '), style: GoogleFonts.orbitron(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 30),
          LinearProgressIndicator(value: _getProgressValue(state), backgroundColor: const Color(0xFF0D1117), color: const Color(0xFF1F6FEB), minHeight: 12, borderRadius: BorderRadius.circular(6)),
          const SizedBox(height: 50),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildSensorNode('L1', socket.sensorStates[17] ?? false),
              _buildSensorNode('L2', socket.sensorStates[27] ?? false),
              _buildSensorNode('L3', socket.sensorStates[22] ?? false),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(child: _buildActionBtn('OTOMASYONU BAŞLAT', const Color(0xFF238636), () => socket.sendCommand('set_mode', 'OTOMATİK'))),
              const SizedBox(width: 20),
              Expanded(child: _buildActionBtn('ACİL DURDURMA', const Color(0xFFDA3633), () => socket.sendCommand('set_mode', 'BEKLEMEDE'))),
            ],
          ),
        ],
      ),
    );
  }

  // --- MANUEL KONTROL ---
  Widget _buildManualControl(SocketService socket) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('MANUEL DONANIM KONTROLÜ', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF8B949E))),
        const SizedBox(height: 30),
        Expanded(
          child: Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: const Color(0xFF161B22), borderRadius: BorderRadius.circular(12)),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 3, crossAxisSpacing: 10, mainAxisSpacing: 10),
                    itemCount: 10,
                    itemBuilder: (ctx, i) => _buildValveBtn(socket, i + 1),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              Container(
                width: 300,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: const Color(0xFF161B22), borderRadius: BorderRadius.circular(12)),
                child: Column(
                  children: [
                    const Text('KAPI KONTROLLERİ', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 20),
                    _buildGateBtn(socket, 1, 'GİRİŞ KAPI AÇ', true),
                    _buildGateBtn(socket, 1, 'GİRİŞ KAPI KAPAT', false),
                    const Divider(height: 40, color: Colors.white10),
                    _buildGateBtn(socket, 2, 'ÇIKIŞ KAPI AÇ', true),
                    _buildGateBtn(socket, 2, 'ÇIKIŞ KAPI KAPAT', false),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // --- REÇETELER ---
  Widget _buildRecipes(SocketService socket) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('REÇETE KÜTÜPHANESİ', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF8B949E))),
        const SizedBox(height: 20),
        Expanded(
          child: ListView.builder(
            itemCount: 5, // Mock data for now
            itemBuilder: (ctx, i) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
              decoration: BoxDecoration(color: const Color(0xFF161B22), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white12)),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: Color(0xFF58A6FF)),
                  const SizedBox(width: 20),
                  Text('REÇETE ${i+1} - ÖRNEK DOLUM', style: const TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  _buildActionBtn('YÜKLE', const Color(0xFF1F6FEB), () {}, height: 40, width: 100),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // --- AYARLAR ---
  Widget _buildSettings(SocketService socket) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('SİSTEM VE MÜHENDİS AYARLARI', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF8B949E))),
        const SizedBox(height: 30),
        Container(
          padding: const EdgeInsets.all(25),
          decoration: BoxDecoration(color: const Color(0xFF161B22), borderRadius: BorderRadius.circular(12)),
          child: Column(
            children: [
              _buildSettingRow('Donanım Senkronizasyonu', 'Arduino Nano kilit ayarlarını Pi üzerinden güncelle.', () {}),
              const Divider(height: 40, color: Colors.white10),
              _buildSettingRow('Sensör Kalibrasyonu', 'Lazer sensör hassasiyet değerlerini ayarla.', () {}),
            ],
          ),
        ),
      ],
    );
  }

  // --- YARDIMCI WIDGETLAR ---
  Widget _buildValveBtn(SocketService socket, int id) {
    return ElevatedButton(
      onPressed: () => socket.sendCommand('toggle_valve', id),
      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF21262D), side: const BorderSide(color: Colors.white10)),
      child: Text('VALF $id', style: const TextStyle(fontSize: 11)),
    );
  }

  Widget _buildGateBtn(SocketService socket, int id, String label, bool open) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: _buildActionBtn(label, open ? const Color(0xFF1F6FEB) : const Color(0xFF30363D), () {}),
    );
  }

  Widget _buildActionBtn(String label, Color color, VoidCallback? onPressed, {double height = 50, double? width}) {
    return SizedBox(
      height: height,
      width: width,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: color, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
      ),
    );
  }

  Widget _buildSettingRow(String title, String desc, VoidCallback onAction) {
    return Row(
      children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          Text(desc, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
        const Spacer(),
        _buildActionBtn('UYGULA', const Color(0xFF1F6FEB), onAction, width: 100, height: 35),
      ],
    );
  }

  Widget _buildSensorNode(String label, bool active) {
    return Column(children: [
      Text(label, style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 10)),
      const SizedBox(height: 10),
      Container(width: 50, height: 8, decoration: BoxDecoration(color: active ? const Color(0xFF3FB950) : const Color(0xFF21262D), borderRadius: BorderRadius.circular(4))),
    ]);
  }

  double _getProgressValue(String state) {
    Map<String, double> progress = {'BEKLEMEDE': 0.0, 'GIRIS_SAYILIYOR': 0.2, 'DOLUM': 0.5, 'TAHLIYE': 0.8, 'DOGRULAMA': 1.0};
    return progress[state] ?? 0.0;
  }
}
