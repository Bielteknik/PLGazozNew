import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'services/socket_service.dart';

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
      title: 'PALANDÖKEN GAZOZ HMI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F1218),
        primaryColor: const Color(0xFF1E88E5),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      ),
      home: const SCADALayout(),
    );
  }
}

class SCADALayout extends StatefulWidget {
  const SCADALayout({super.key});

  @override
  State<SCADALayout> createState() => _SCADALayoutState();
}

class _SCADALayoutState extends State<SCADALayout> {
  int _selectedIndex = 1;
  bool _isSidebarCollapsed = true;

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context);
    final data = socket.productionData;
    bool isWorking = data['state'] != 'BEKLEMEDE';

    return Scaffold(
      body: Row(
        children: [
          _buildSidebar(isWorking),
          Expanded(
            child: Column(
              children: [
                _buildTopBar(socket),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: _buildBody(socket),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar(bool isWorking) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: _isSidebarCollapsed ? 60 : 180,
      decoration: const BoxDecoration(
        color: Color(0xFF151921),
        border: Border(right: BorderSide(color: Colors.white10)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          IconButton(
            icon: Icon(_isSidebarCollapsed ? Icons.chevron_right : Icons.chevron_left, color: Colors.white38),
            onPressed: () => setState(() => _isSidebarCollapsed = !_isSidebarCollapsed),
          ),
          const SizedBox(height: 10),
          _sidebarItem(0, 'AÇILIŞ', Icons.dashboard_outlined),
          _sidebarItem(1, 'İzleme', Icons.monitor_heart_outlined),
          _sidebarItem(2, 'Donanım', Icons.settings_input_component),
          _sidebarItem(3, 'Manuel', Icons.tune),
          _sidebarItem(4, 'Geçmiş', Icons.history),
          _sidebarItem(5, 'Arıza', Icons.report_problem),
          const Spacer(),
          // SETTINGS BUTTON (Above Exit)
          _sidebarItem(6, 'Ayarlar', Icons.settings_outlined),
          const SizedBox(height: 30), // Spacing between Settings and Exit
          // EXIT BUTTON (Bottom)
          Opacity(
            opacity: isWorking ? 0.3 : 1.0,
            child: IconButton(
              icon: const Icon(Icons.power_settings_new, color: Colors.redAccent, size: 28),
              onPressed: isWorking ? null : () => _showExitDialog(),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _sidebarItem(int index, String label, IconData icon) {
    bool isSelected = _selectedIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedIndex = index),
      child: Container(
        height: 45,
        margin: const EdgeInsets.symmetric(vertical: 2),
        decoration: BoxDecoration(
          border: isSelected ? const Border(left: BorderSide(color: Colors.blueAccent, width: 3)) : null,
          color: isSelected ? Colors.blueAccent.withOpacity(0.1) : Colors.transparent,
        ),
        child: Row(
          mainAxisAlignment: _isSidebarCollapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
          children: [
            if (!_isSidebarCollapsed) const SizedBox(width: 15),
            Icon(icon, color: isSelected ? Colors.blueAccent : Colors.white38, size: 20),
            if (!_isSidebarCollapsed) ...[
              const SizedBox(width: 12),
              Text(label, style: TextStyle(color: isSelected ? Colors.white : Colors.white38, fontSize: 12)),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar(SocketService socket) {
    final data = socket.productionData;
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF151921),
        border: Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(4)),
            child: const Icon(Icons.check_box_outline_blank, size: 16, color: Colors.white24),
          ),
          const SizedBox(width: 12),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(data['state'] ?? 'Hazır Durumda', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
              Text(data['mode'] ?? 'Beklemede', style: const TextStyle(fontSize: 10, color: Colors.white24)),
            ],
          ),
          const SizedBox(width: 20),
          _buildBadge('YIKAMA TAMAM', Colors.greenAccent),
          const Spacer(),
          _buildActionBtn('YIKAMAYI BAŞLAT', const Color(0xFF1E2644), Icons.water_drop_outlined, () {}),
          const SizedBox(width: 10),
          _buildActionBtn('ÜRETİMİ BAŞLAT', const Color(0xFF0E3021), Icons.play_arrow_outlined, () {
            socket.sendCommand('set_mode', 'OTOMATİK');
          }, iconColor: Colors.greenAccent),
          const SizedBox(width: 10),
          _buildActionBtn('ACİL DURDUR', const Color(0xFF421519), Icons.power_settings_new, () {
            socket.sendCommand('set_mode', 'BEKLEMEDE');
          }, iconColor: Colors.redAccent),
        ],
      ),
    );
  }

  Widget _buildBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), border: Border.all(color: color.withOpacity(0.3)), borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildActionBtn(String label, Color bgColor, IconData icon, VoidCallback onTap, {Color iconColor = Colors.white70}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.white10)),
        child: Row(
          children: [
            Icon(icon, size: 14, color: iconColor),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(SocketService socket) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildRecipeCard('Standart Şişe (500ml)', '3 Adet', '4s', true)),
            const SizedBox(width: 12),
            Expanded(child: _buildRecipeCard('Büyük Şişe (1.5L)', '3 Adet', '8.5s', false)),
            const SizedBox(width: 12),
            Expanded(child: _buildRecipeCard('Küçük Cam Şişe (250ml)', '3 Adet', '2.5s', false)),
          ],
        ),
        const SizedBox(height: 12),
        Expanded(
          child: Row(
            children: [
              Expanded(flex: 3, child: _buildMimicPanel(socket)),
              const SizedBox(width: 12),
              Expanded(flex: 1, child: _buildWarningsPanel()),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 160,
          child: Row(
            children: [
              Expanded(flex: 3, child: _buildLogPanel()),
              const SizedBox(width: 12),
              Expanded(flex: 1, child: _buildPlanPanel()),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRecipeCard(String title, String count, String time, bool selected) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF151921),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: selected ? Colors.blueAccent : Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ÜRETİM REÇETESİ', style: TextStyle(fontSize: 8, color: Colors.blueAccent, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.layers_outlined, size: 12, color: Colors.white24),
              const SizedBox(width: 4),
              Text(count, style: const TextStyle(fontSize: 10, color: Colors.white24)),
              const SizedBox(width: 12),
              const Icon(Icons.timer_outlined, size: 12, color: Colors.white24),
              const SizedBox(width: 4),
              Text(time, style: const TextStyle(fontSize: 10, color: Colors.white24)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMimicPanel(SocketService socket) {
    final data = socket.productionData;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF11141D), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.white10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.settings_suggest_outlined, size: 14, color: Colors.white24),
              SizedBox(width: 8),
              Text('Görsel Akış Kontrolü', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white38)),
            ],
          ),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                double w = constraints.maxWidth;
                double h = constraints.maxHeight;
                return Stack(
                  children: [
                    // PIPELINES
                    Positioned(top: h * 0.3, left: 0, right: 0, child: Container(height: 2, color: Colors.white10)),
                    Positioned(top: h * 0.7, left: 0, right: 0, child: Container(height: 2, color: Colors.white10)),

                    // COUNTERS (Fixed absolute top positions)
                    Positioned(left: 100, top: 10, child: _counterUnit('GİRİŞ', '${data['inputCount']}', Colors.orangeAccent)),
                    Positioned(left: w/2 - 50, top: 10, child: _counterUnit('HEDEF', '3', const Color(0xFF2E3A5F), isCenter: true)),
                    Positioned(right: 100, top: 10, child: _counterUnit('ÇIKIŞ', '${data['outputCount']}', Colors.greenAccent)),

                    // NOZZLES
                    _pos(w * 0.25, h * 0.3, _nozzleUnit('V3')),
                    _pos(w * 0.5, h * 0.3, _nozzleUnit('V2')),
                    _pos(w * 0.75, h * 0.3, _nozzleUnit('V1')),

                    // GATES (PIXEL POSITIONED as requested)
                    Positioned(left: 20, top: h * 0.45, child: _gateChamber('GİRİŞ', true)),
                    Positioned(right: 20, top: h * 0.45, child: _gateChamber('ÇIKIŞ', false)),
                  ],
                );
              }
            ),
          ),
        ],
      ),
    );
  }

  Widget _pos(double x, double y, Widget child) => Positioned(left: x, top: y, child: child);

  Widget _counterUnit(String label, String val, Color color, {bool isCenter = false}) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 9, color: Colors.white24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Container(
          width: isCenter ? 100 : 80,
          height: isCenter ? 60 : 50,
          decoration: BoxDecoration(
            color: const Color(0xFF151921),
            border: Border.all(color: isCenter ? const Color(0xFF3F4E7A) : Colors.white10, width: isCenter ? 2 : 1),
            borderRadius: BorderRadius.circular(4),
          ),
          alignment: Alignment.center,
          child: Text(val, style: GoogleFonts.orbitron(fontSize: isCenter ? 26 : 22, fontWeight: FontWeight.bold, color: color)),
        ),
        if (!isCenter) Container(width: 40, height: 4, color: color),
      ],
    );
  }

  Widget _nozzleUnit(String label) {
    return Column(
      children: [
        Container(
          width: 35, height: 25,
          decoration: const BoxDecoration(color: Color(0xFF1C222E), borderRadius: BorderRadius.only(bottomLeft: Radius.circular(4), bottomRight: Radius.circular(4))),
          alignment: Alignment.center,
          child: Text(label, style: const TextStyle(fontSize: 8, color: Colors.white38, fontWeight: FontWeight.bold)),
        ),
        Container(width: 8, height: 20, color: Colors.white10),
      ],
    );
  }

  Widget _gateChamber(String label, bool isLocked) {
    return Column(
      children: [
        Container(
          width: 25, height: 90,
          decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.8), borderRadius: BorderRadius.circular(4)),
        ),
        const SizedBox(height: 8),
        Container(
          width: 55, height: 50,
          decoration: BoxDecoration(color: const Color(0xFF1C222E), border: Border.all(color: Colors.white10), borderRadius: BorderRadius.circular(6)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 16, color: isLocked ? Colors.redAccent : Colors.white10),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 9, color: Colors.white24)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildWarningsPanel() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF151921), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.white10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.warning_amber_outlined, size: 14, color: Colors.orangeAccent),
              SizedBox(width: 8),
              Text('AKTİF UYARILAR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white38)),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.orangeAccent.withOpacity(0.05), border: Border.all(color: Colors.orangeAccent.withOpacity(0.2)), borderRadius: BorderRadius.circular(4)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('SYS_ACTIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orangeAccent)),
                Text('Sistem Aktif', style: TextStyle(fontSize: 10, color: Colors.white70)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogPanel() {
    return Container(
      decoration: BoxDecoration(color: const Color(0xFF0B0E14), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.white10)),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white10))),
            width: double.infinity,
            child: const Text('SİSTEM DURUMU / HABERLEŞME MESAJLARI', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white24)),
          ),
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              child: const Text('[09:15:37] [SYS] Master terminal initialized.', style: TextStyle(fontSize: 11, color: Colors.greenAccent, fontFamily: 'monospace')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanPanel() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF151921), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.white10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('MEVCUT ÜRETİM PLANI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orangeAccent)),
          const Spacer(),
          _planRow('Reçete:', 'Standart Şişe (500ml)'),
          _planRow('Hedef:', '3 Adet'),
          _planRow('Gürültü Filtresi:', '35ms (ADAPTİF)', valColor: Colors.greenAccent),
        ],
      ),
    );
  }

  Widget _planRow(String label, String val, {Color valColor = Colors.white}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.white24)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              val, 
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: valColor),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  void _showExitDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF151921),
        title: const Text('Uygulamadan Çıkış'),
        content: const Text('HMI uygulamasını kapatmak ve ana ekrana dönmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('İPTAL')),
          TextButton(
            onPressed: () {
              if (Platform.isAndroid) {
                SystemNavigator.pop();
              } else {
                exit(0);
              }
            },
            child: const Text('ÇIKALIM', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }
}
