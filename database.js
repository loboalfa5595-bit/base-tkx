const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let dbPath = path.join(__dirname, 'database.db');
if (process.env.DATABASE_PATH) {
  try {
    fs.mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true });
    dbPath = process.env.DATABASE_PATH;
  } catch (_) {}
} else if (
  process.env.RENDER === 'true' ||
  process.env.RENDER_EXTERNAL_URL ||
  (fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory())
) {
  try {
    fs.mkdirSync('/var/data', { recursive: true });
    dbPath = '/var/data/database.db';
  } catch (_) {}
}
console.log(`[DB] Usando arquivo de banco: ${dbPath}`);

let db;
let readyPromise = null;

function save() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('[DB save error]', e.message);
  }
}

function colunaExiste(tabela, coluna) {
  try {
    const stmt = db.prepare(`PRAGMA table_info(${tabela})`);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (String(row.name).toLowerCase() === String(coluna).toLowerCase()) {
        stmt.free();
        return true;
      }
    }
    stmt.free();
    return false;
  } catch (e) {
    return false;
  }
}

function adicionarColunaSeFaltar(tabela, coluna, definicao) {
  if (!colunaExiste(tabela, coluna)) {
    try {
      db.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
      console.log(`[DB migrate] Coluna ${tabela}.${coluna} adicionada.`);
      return true;
    } catch (e) {
      console.error(`[DB migrate] Falha ao adicionar ${tabela}.${coluna}:`, e.message);
      return false;
    }
  }
  return false;
}

function tabelaExiste(nome) {
  try {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
    stmt.bind([nome]);
    const ok = stmt.step() ? true : false;
    stmt.free();
    return ok;
  } catch (e) {
    return false;
  }
}

function open() {
  if (readyPromise) return readyPromise;

  readyPromise = Promise.resolve()
    .then(() => initSqlJs())
    .then((mod) => {
      let fileBuffer = null;
      if (fs.existsSync(dbPath)) {
        try { fileBuffer = fs.readFileSync(dbPath); } catch (_) {}
      }
      db = new mod.Database(fileBuffer);

      db.run(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id TEXT PRIMARY KEY,
          nickname_template TEXT DEFAULT '[{TAG}] {NOME} | {ID}',
          bot_name TEXT DEFAULT 'Bot Setagem',
          bot_model TEXT DEFAULT 'v1.0',
          set_form_channel_id TEXT,
          set_approval_channel_id TEXT,
          set_log_channel_id TEXT,
          set_form_title TEXT DEFAULT 'Formulário de Setagem',
          set_form_description TEXT DEFAULT 'Preencha os campos abaixo para solicitar sua setagem. Um administrador irá analisar.',
          set_form_image TEXT,
          set_form_color TEXT DEFAULT '#ff0040',
          set_form_footer TEXT DEFAULT 'Sistema de Setagem AI Studio',
          set_form_dm_enabled INTEGER DEFAULT 1,
          set_form_dm_message TEXT DEFAULT 'Olá {USER}! Sua solicitação de setagem foi **{STATUS}**.\n\nCargo: [{TAG}] {NOME} | {ID}\nResponsável: {STAFF}\n{OBS}',
          set_form_require_approval INTEGER DEFAULT 1,
          set_form_role_required TEXT,
          set_form_role_assignment INTEGER DEFAULT 1
        );
      `);

      const colunasGuildConfig = [
        ['nickname_template', "TEXT DEFAULT '[{TAG}] {NOME} | {ID}'"],
        ['bot_name', "TEXT DEFAULT 'Bot Setagem'"],
        ['bot_model', "TEXT DEFAULT 'v1.0'"],
        ['set_form_channel_id', 'TEXT'],
        ['set_approval_channel_id', 'TEXT'],
        ['set_log_channel_id', 'TEXT'],
        ['set_form_title', "TEXT DEFAULT 'Formulário de Setagem'"],
        ['set_form_description', "TEXT DEFAULT 'Preencha os campos abaixo para solicitar sua setagem. Um administrador irá analisar.'"],
        ['set_form_image', 'TEXT'],
        ['set_form_color', "TEXT DEFAULT '#ff0040'"],
        ['set_form_footer', "TEXT DEFAULT 'Sistema de Setagem AI Studio'"],
        ['set_form_dm_enabled', 'INTEGER DEFAULT 1'],
        ['set_form_dm_message', "TEXT DEFAULT 'Olá {USER}! Sua solicitação de setagem foi **{STATUS}**.\n\nCargo: [{TAG}] {NOME} | {ID}\nResponsável: {STAFF}\n{OBS}'"],
        ['set_form_require_approval', 'INTEGER DEFAULT 1'],
        ['set_form_role_required', 'TEXT'],
        ['set_form_role_assignment', 'INTEGER DEFAULT 1'],
      ];
      for (const [col, def] of colunasGuildConfig) {
        adicionarColunaSeFaltar('guild_config', col, def);
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS cargos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          tag TEXT NOT NULL,
          discord_role_id TEXT,
          UNIQUE(guild_id, nome),
          UNIQUE(guild_id, tag)
        );
      `);
      adicionarColunaSeFaltar('cargos', 'discord_role_id', 'TEXT');

      db.run(`
        CREATE TABLE IF NOT EXISTS membros_setados (
          user_id TEXT PRIMARY KEY,
          guild_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          identificador TEXT NOT NULL,
          cargo_tag TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          approved_by TEXT,
          approved_at TEXT
        );
      `);
      const colunasMembros = [
        ['guild_id', 'TEXT NOT NULL'],
        ['created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
        ['approved_by', 'TEXT'],
        ['approved_at', 'TEXT'],
      ];
      for (const [col, def] of colunasMembros) {
        adicionarColunaSeFaltar('membros_setados', col, def);
      }

      if (!tabelaExiste('setagems_pendentes')) {
        db.run(`
          CREATE TABLE setagems_pendentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            identificador TEXT NOT NULL,
            cargo_tag TEXT NOT NULL,
            requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'PENDENTE',
            approver_id TEXT,
            approved_at TEXT,
            reason TEXT,
            approval_message_id TEXT,
            approval_channel_id TEXT,
            dm_notified INTEGER DEFAULT 0
          );
        `);
        console.log('[DB migrate] Tabela setagems_pendentes criada.');
      } else {
        const colunasPend = [
          ['requested_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
          ['status', "TEXT DEFAULT 'PENDENTE'"],
          ['approver_id', 'TEXT'],
          ['approved_at', 'TEXT'],
          ['reason', 'TEXT'],
          ['approval_message_id', 'TEXT'],
          ['approval_channel_id', 'TEXT'],
          ['dm_notified', 'INTEGER DEFAULT 0'],
        ];
        for (const [col, def] of colunasPend) {
          adicionarColunaSeFaltar('setagems_pendentes', col, def);
        }
      }

      save();
      return db;
    })
    .catch((err) => {
      readyPromise = null;
      console.error('[DB init] falhou:', err);
      throw err;
    });

  return readyPromise;
}

const defaultCargos = [
  { nome: 'Membro', tag: 'MBR' },
  { nome: 'Vendedor', tag: 'VEN' },
  { nome: 'Gerente', tag: 'GER' },
  { nome: 'Administrador', tag: 'ADM' },
  { nome: 'Dono', tag: 'DONO' },
];

async function initGuild(guildId) {
  if (!db) await open();
  const stmt = db.prepare('SELECT guild_id FROM guild_config WHERE guild_id = ?');
  stmt.bind([guildId]);
  const existing = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();

  if (!existing) {
    db.run('INSERT INTO guild_config (guild_id) VALUES (?)', [guildId]);
    for (const c of defaultCargos) {
      try {
        db.run(
          'INSERT INTO cargos (guild_id, nome, tag) VALUES (?, ?, ?)',
          [guildId, c.nome, c.tag]
        );
      } catch (_) {}
    }
    save();
  }
}

async function getGuildConfig(guildId) {
  await initGuild(guildId);
  const stmt = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?');
  stmt.bind([guildId]);
  let result = null;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
}

async function updateGuildConfig(guildId, fields) {
  await initGuild(guildId);
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  values.push(guildId);
  db.run(`UPDATE guild_config SET ${sets} WHERE guild_id = ?`, values);
  save();
}

async function getCargos(guildId) {
  await initGuild(guildId);
  const stmt = db.prepare('SELECT * FROM cargos WHERE guild_id = ? ORDER BY id');
  stmt.bind([guildId]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function getCargoByTag(guildId, tag) {
  await initGuild(guildId);
  const stmt = db.prepare('SELECT * FROM cargos WHERE guild_id = ? AND tag = ?');
  stmt.bind([guildId, tag]);
  let r = null;
  if (stmt.step()) r = stmt.getAsObject();
  stmt.free();
  return r;
}

async function addCargo(guildId, nome, tag, discordRoleId) {
  await initGuild(guildId);
  db.run(
    'INSERT INTO cargos (guild_id, nome, tag, discord_role_id) VALUES (?, ?, ?, ?)',
    [guildId, nome, tag, discordRoleId || null]
  );
  save();
  return { changes: 1 };
}

async function updateCargoDiscordRole(guildId, tag, discordRoleId) {
  await initGuild(guildId);
  db.run(
    'UPDATE cargos SET discord_role_id = ? WHERE guild_id = ? AND tag = ?',
    [discordRoleId || null, guildId, tag]
  );
  save();
}

async function removeCargo(guildId, nomeOuTag) {
  await initGuild(guildId);
  const stmt = db.prepare(
    'DELETE FROM cargos WHERE guild_id = ? AND (nome = ? OR tag = ?)'
  );
  stmt.bind([guildId, nomeOuTag, nomeOuTag]);
  stmt.step();
  stmt.free();
  save();
  return { changes: db.getRowsModified() };
}

async function upsertMembro(data) {
  if (!db) await open();
  db.run(
    `
    INSERT INTO membros_setados (user_id, guild_id, nome, identificador, cargo_tag, approved_by, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      nome = excluded.nome,
      identificador = excluded.identificador,
      cargo_tag = excluded.cargo_tag,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at
    `,
    [
      data.user_id, data.guild_id, data.nome, data.identificador, data.cargo_tag,
      data.approved_by || null, data.approved_at || null,
    ]
  );
  save();
  return { changes: 1 };
}

async function getMembro(userId) {
  if (!db) await open();
  const stmt = db.prepare('SELECT * FROM membros_setados WHERE user_id = ?');
  stmt.bind([userId]);
  let result = null;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
}

async function criarSetagemPendente(data) {
  if (!db) await open();
  const stmt = db.run(
    `INSERT INTO setagems_pendentes
      (guild_id, user_id, nome, identificador, cargo_tag, approval_channel_id, approval_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.guild_id, data.user_id, data.nome, data.identificador, data.cargo_tag,
      data.approval_channel_id || null, data.approval_message_id || null,
    ]
  );
  save();
  return { id: stmt.lastInsertRowid };
}

async function getSetagemPendente(id) {
  if (!db) await open();
  const stmt = db.prepare('SELECT * FROM setagems_pendentes WHERE id = ?');
  stmt.bind([id]);
  let r = null;
  if (stmt.step()) r = stmt.getAsObject();
  stmt.free();
  return r;
}

async function getSetagensPendentesPorGuild(guildId) {
  if (!db) await open();
  const stmt = db.prepare(
    "SELECT * FROM setagems_pendentes WHERE guild_id = ? AND status = 'PENDENTE' ORDER BY requested_at DESC"
  );
  stmt.bind([guildId]);
  const r = [];
  while (stmt.step()) r.push(stmt.getAsObject());
  stmt.free();
  return r;
}

async function atualizarStatusSetagem(id, fields) {
  if (!db) await open();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  values.push(id);
  db.run(`UPDATE setagems_pendentes SET ${sets} WHERE id = ?`, values);
  save();
}

module.exports = {
  open,
  initGuild,
  getGuildConfig,
  updateGuildConfig,
  getCargos,
  getCargoByTag,
  addCargo,
  updateCargoDiscordRole,
  removeCargo,
  upsertMembro,
  getMembro,
  criarSetagemPendente,
  getSetagemPendente,
  getSetagensPendentesPorGuild,
  atualizarStatusSetagem,
};
