import Avatar from './Avatar'

export default function PlayerList({ players, identity, peers }) {
  return (
    <aside className="players">
      <header>
        <h2>Jugadores</h2>
        <span>{players.length || (identity ? 1 : 0)}</span>
      </header>
      <ul>
        {(players.length ? players : identity ? [{ ...identity, self: true }] : []).map((player) => (
          <li key={player.id} className={player.self ? 'is-self' : ''}>
            <Avatar name={player.name} src={player.avatar} size={32} />
            <div>
              <strong>{player.name}</strong>
              <small>{player.self ? 'Tú' : player.source === 'discord' ? 'En la activity' : 'En mesa'}</small>
            </div>
          </li>
        ))}
      </ul>
      <footer>
        <i className={peers > 1 ? 'dot on' : 'dot'} />
        {peers > 1 ? `${peers} conectados` : 'Esperando coterie'}
      </footer>
    </aside>
  )
}
