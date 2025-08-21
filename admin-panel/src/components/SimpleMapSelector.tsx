import React, { useState, useEffect, useRef } from 'react';
import { Button, Space, Typography, Alert, Input, Card } from 'antd';
import { 
  AimOutlined, 
  EnvironmentOutlined, 
  SearchOutlined,
  ReloadOutlined,
  LinkOutlined
} from '@ant-design/icons';

// CSS Animation styles
const animationStyles = `
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0) translate(-50%, -50%);
    }
    40% {
      transform: translateY(-10px) translate(-50%, -50%);
    }
    60% {
      transform: translateY(-5px) translate(-50%, -50%);
    }
  }
  
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1) translate(-50%, -50%);
    }
    100% {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }
  }
`;

const { Text } = Typography;

interface SimpleMapSelectorProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  height?: number;
}

const SimpleMapSelector: React.FC<SimpleMapSelectorProps> = ({
  onLocationSelect,
  initialLat = 40.3167,
  initialLng = 36.5500,
  height = 400
}) => {
  const [selectedPosition, setSelectedPosition] = useState<{lat: number, lng: number, x: number, y: number} | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng, x: 50, y: 50 } : null
  );
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [mapCenter, setMapCenter] = useState({ lat: 40.3167, lng: 36.5500 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMapLoading, setIsMapLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update iframe src when mapCenter changes (with debounce)
  useEffect(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (iframeRef.current) {
        setIsMapLoading(true);
        const newUrl = `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=14&output=embed`;
        iframeRef.current.src = newUrl;
      }
    }, isDragging ? 1000 : 300); // Longer delay while dragging

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [mapCenter, isDragging]);

  const handleLocationSelect = (lat: number, lng: number, x?: number, y?: number) => {
    setSelectedPosition({ lat, lng, x: x || 50, y: y || 50 });
    onLocationSelect(lat, lng);
    setManualLat(lat.toFixed(6));
    setManualLng(lng.toFixed(6));
  };

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Geçerli koordinat değerleri girin');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Enlem -90 ile 90 arasında olmalı');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      alert('Boylam -180 ile 180 arasında olmalı');
      return;
    }
    
    handleLocationSelect(lat, lng);
  };

  const resetToTokat = () => {
    handleLocationSelect(40.3167, 36.5500);
  };

  const openGoogleMaps = () => {
    const lat = selectedPosition?.lat || 40.3167;
    const lng = selectedPosition?.lng || 36.5500;
    window.open(`https://www.google.com/maps/@${lat},${lng},15z`, '_blank');
  };

  // Google Maps iframe URL
  const googleMapsUrl = `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&z=14&output=embed`;

  return (
    <div>
      {/* Inject CSS animations */}
      <style>{animationStyles}</style>
      
      {/* Manual Location Input */}
      <Card title="📍 Konum Girişi" style={{ marginBottom: '16px' }}>
        <Space.Compact style={{ width: '100%', marginBottom: '12px' }}>
          <Input
            placeholder="Enlem (örn: 40.316700)"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            style={{ width: '40%' }}
            prefix="📐"
          />
          <Input
            placeholder="Boylam (örn: 36.550000)"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            style={{ width: '40%' }}
            prefix="🧭"
          />
          <Button 
            type="primary" 
            onClick={handleManualSubmit}
            style={{ width: '20%' }}
            icon={<AimOutlined />}
          >
            Seç
          </Button>
        </Space.Compact>
        
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={resetToTokat}
            size="small"
          >
            Tokat Merkezi
          </Button>
          <Button 
            icon={<LinkOutlined />} 
            onClick={openGoogleMaps}
            size="small"
            disabled={!selectedPosition}
          >
            Google Maps'te Aç
          </Button>
        </Space>
      </Card>

      {/* Info Alert */}
      <Alert
        message="Konum Seçimi"
        description="Yukarıdaki alanlara enlem ve boylam değerlerini girerek konum belirleyebilirsiniz. Google Maps'ten kopyaladığınız koordinatları da yapıştırabilirsiniz."
        type="info"
        showIcon
        icon={<EnvironmentOutlined />}
        style={{ marginBottom: '16px' }}
      />

      {/* Google Maps Embed */}
      <div style={{ border: '2px solid #d9d9d9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
        <iframe
          ref={iframeRef}
          width="100%"
          height={height}
          style={{ border: 0 }}
          src={googleMapsUrl}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setIsMapLoading(false)}
        />

        {/* Loading Overlay */}
        {isMapLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
            fontSize: '16px',
            color: '#666'
          }}>
            🔄 Harita güncelleniyor...
          </div>
        )}
        
        {/* Selected Position Marker Overlay */}
        {selectedPosition && (
          <div
            style={{
              position: 'absolute',
              top: `${selectedPosition.y}%`,
              left: `${selectedPosition.x}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 3,
              fontSize: '32px',
              textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
              animation: 'bounce 1s ease-in-out',
              transition: 'all 0.3s ease-in-out',
              pointerEvents: 'none'
            }}
          >
            📍
          </div>
        )}

        {/* Interactive Overlay for Coordinate Selection */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0)',
            cursor: isDragging ? 'grabbing' : 'crosshair',
            zIndex: 2,
            userSelect: 'none'
          }}
          onClick={(e) => {
            if (isDragging) return; // Prevent click when dragging
            
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate percentage position
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;
            
            // Convert pixel coordinates to lat/lng (Tokat bölgesi için mapping)
            const latRange = 0.1; // ±0.1 derece yaklaşık ±11km aralığı
            const lngRange = 0.1;
            
            const lat = mapCenter.lat + latRange * (0.5 - yPercent / 100);
            const lng = mapCenter.lng + lngRange * (xPercent / 100 - 0.5);
            
            handleLocationSelect(lat, lng, xPercent, yPercent);
          }}
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={(e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;
            
            // Convert pixel movement to coordinate changes (more sensitive)
            const latDelta = (deltaY / height) * 0.01; // Increased sensitivity for iframe
            const lngDelta = (deltaX / height) * 0.01; // Increased sensitivity for iframe
            
            const newMapCenter = {
              lat: mapCenter.lat + latDelta,
              lng: mapCenter.lng - lngDelta
            };
            
            setMapCenter(newMapCenter);
            setDragStart({ x: e.clientX, y: e.clientY });
          }}
          onMouseUp={() => {
            setIsDragging(false);
          }}
          onMouseLeave={() => {
            setIsDragging(false);
          }}
          title={isDragging ? "Haritayı kaydırıyorsunuz" : "Tıklayarak konum seçin veya sürükleyerek haritayı kaydırın"}
        />

        {/* Info Overlay */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#333',
          zIndex: 3,
          border: '1px solid #ddd',
          maxWidth: '200px'
        }}>
          <div>🖱️ <strong>Tıkla:</strong> Konum seç</div>
          <div>🤏 <strong>Sürükle:</strong> Haritayı kaydır</div>
        </div>

        {/* Coordinates Display */}
        {selectedPosition && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(24, 144, 255, 0.95)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 3,
            border: '1px solid #1890ff'
          }}>
            📍 {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
          </div>
        )}

        {/* Map Center Display */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          zIndex: 3,
          border: '1px solid #333'
        }}>
          🗺️ Merkez: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
        </div>

        {/* Map Controls */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 3,
          display: 'flex',
          gap: '4px'
        }}>
          <Button 
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              setMapCenter({ lat: 40.3167, lng: 36.5500 });
              setSelectedPosition(null);
            }}
            title="Haritayı merkeze getir"
          />
        </div>
      </div>

      {/* Fallback Static Map (when Google Maps doesn't work) */}
      {!selectedPosition && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
          <Text>
            Yukarıdaki manuel koordinat girişi veya popüler konumlardan birini seçerek başlayabilirsiniz.
          </Text>
        </div>
      )}

      {/* Popular Locations */}
      <Card title="📍 Popüler Konumlar" style={{ marginTop: '16px' }}>
        <Space wrap>
          <Button 
            size="small" 
            onClick={() => {
              const lat = 40.3218, lng = 36.5561;
              // Calculate pixel position for this coordinate
              const latRange = 0.1, lngRange = 0.1;
              const yPercent = (0.5 - (lat - mapCenter.lat) / latRange) * 100;
              const xPercent = ((lng - mapCenter.lng) / lngRange + 0.5) * 100;
              handleLocationSelect(lat, lng, Math.max(0, Math.min(100, xPercent)), Math.max(0, Math.min(100, yPercent)));
            }}
          >
            🏛️ TOGÜ Merkez Kampüs
          </Button>
          <Button 
            size="small" 
            onClick={() => {
              const lat = 40.3167, lng = 36.5500;
              const latRange = 0.1, lngRange = 0.1;
              const yPercent = (0.5 - (lat - mapCenter.lat) / latRange) * 100;
              const xPercent = ((lng - mapCenter.lng) / lngRange + 0.5) * 100;
              handleLocationSelect(lat, lng, Math.max(0, Math.min(100, xPercent)), Math.max(0, Math.min(100, yPercent)));
            }}
          >
            🏢 Tokat Merkez
          </Button>
          <Button 
            size="small" 
            onClick={() => {
              const lat = 40.3298, lng = 36.5542;
              const latRange = 0.1, lngRange = 0.1;
              const yPercent = (0.5 - (lat - mapCenter.lat) / latRange) * 100;
              const xPercent = ((lng - mapCenter.lng) / lngRange + 0.5) * 100;
              handleLocationSelect(lat, lng, Math.max(0, Math.min(100, xPercent)), Math.max(0, Math.min(100, yPercent)));
            }}
          >
            🏥 Tokat Devlet Hastanesi
          </Button>
          <Button 
            size="small" 
            onClick={() => {
              const lat = 40.3175, lng = 36.5461;
              const latRange = 0.1, lngRange = 0.1;
              const yPercent = (0.5 - (lat - mapCenter.lat) / latRange) * 100;
              const xPercent = ((lng - mapCenter.lng) / lngRange + 0.5) * 100;
              handleLocationSelect(lat, lng, Math.max(0, Math.min(100, xPercent)), Math.max(0, Math.min(100, yPercent)));
            }}
          >
            🚌 Tokat Otogar
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default SimpleMapSelector;