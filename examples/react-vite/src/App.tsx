const demoItems = [
  { id: 1, label: "Visible mapped card", visible: true },
  { id: 2, label: "Filtered mapped card", visible: false }
]

export function App() {
  const showBanner = true

  return (
    <main className="shell">
      <p className="eyebrow">React + Vite fixture</p>
      <h1>Delete React components from the browser.</h1>
      <section className="plain-card">Plain deletable component</section>
      {showBanner && (
        <aside className="conditional-card">Conditional component</aside>
      )}
      <div className="mapped-grid">
        {demoItems
          .filter((item) => item.visible)
          .map((item) => (
            <article className="mapped-card" key={item.id}>
              {item.label}
            </article>
          ))}
      </div>
    </main>
  )
}
