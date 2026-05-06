import { useState } from 'react';

export default function App() {
  console.log("App: Guvenli Modda Baslatildi.");
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <div style={{
      backgroundColor: '#0B0D11',
      color: 'white',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: '#F97316' }}>Palandöken Gazoz HMI</h1>
      <p style={{ color: '#666' }}>Sistem Modu: GÜVENLİ MOD (Yükleniyor...)</p>
      
      <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #333', borderRadius: '8px' }}>
        <p>Eğer bu ekranı görüyorsanız, temel React yapısı çalışıyor demektir.</p>
        <p>Şimdi ağır kütüphaneleri (Lucide, Motion) teker teker geri yükleyeceğiz.</p>
      </div>
    </div>
  );
}
