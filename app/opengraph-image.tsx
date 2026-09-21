import { ImageResponse } from 'next/og';
export const dynamic = 'force-static';
export const alt = 'HistoryOfAtlas — History through maps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#071b29',
        color: '#f0eadf',
        position: 'relative',
        padding: '80px',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          width: 530,
          height: 530,
          border: '1px solid #244454',
          borderRadius: '50%',
          right: -90,
          top: 40,
        }}
      />
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          width: 350,
          height: 530,
          border: '1px solid #244454',
          borderRadius: '50%',
          right: 0,
          top: 40,
        }}
      />
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          width: 150,
          height: 530,
          border: '1px solid #244454',
          borderRadius: '50%',
          right: 100,
          top: 40,
        }}
      />
      <div
        style={{
          fontSize: 17,
          letterSpacing: '5px',
          color: '#c6a76d',
          display: 'flex',
          marginBottom: 42,
        }}
      >
        5,500 YEARS · A WORLD IN MOTION
      </div>
      <div style={{ fontSize: 100, fontFamily: 'serif', letterSpacing: '-4px', display: 'flex' }}>
        HistoryOfAtlas
      </div>
      <div style={{ fontSize: 34, color: '#bccbd1', display: 'flex', marginTop: 20 }}>
        History through maps.
      </div>
      <div style={{ fontSize: 16, color: '#c6a76d', display: 'flex', marginTop: 66 }}>
        TERRITORIES · CONFLICTS · OPEN SOURCES
      </div>
    </div>,
    size,
  );
}
