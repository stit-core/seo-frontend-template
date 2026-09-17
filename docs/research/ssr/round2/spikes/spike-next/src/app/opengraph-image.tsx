import { ImageResponse } from 'next/og'

export const alt = 'stit demo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#17171a',
        color: '#fbfbfa',
        padding: 64,
        fontSize: 64,
      }}
    >
      <div style={{ fontSize: 28, opacity: 0.6 }}>stit demo</div>
      <div>Reference content site</div>
    </div>,
    size,
  )
}
