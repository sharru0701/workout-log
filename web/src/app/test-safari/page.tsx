export default function TestSafariPage() {
  // 30개의 카드 생성
  const cards = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
      {cards.map((num) => (
        <div key={num} className="card">
          <div className="card-header">
            <h3 className="card-title">스크롤 테스트 카드 {num}</h3>
          </div>
          <p style={{ font: 'var(--font-secondary)', color: 'var(--color-text-muted)' }}>
            Safari 상/하단 바 뒤로 넘어가는지 관찰하세요. (Safe area 패딩이 미적용된 상태입니다.)
          </p>
        </div>
      ))}
    </div>
  );
}
