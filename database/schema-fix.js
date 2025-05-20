// database/schema-fix.js
// This script is for applying ad-hoc fixes or ensuring schema consistency
// outside of the formal migration versions.

// Helper to check if a table exists
async function tableExists(db, tableName) {
  try {
    const result = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", [tableName]);
    return !!result;
  } catch (error) {
    console.error(`[SCHEMA FIX] Erro ao verificar se a tabela '${tableName}' existe:`, error);
    return false; // Assume not exists on error
  }
}

// Helper to check if a column exists in a table
async function columnExists(db, tableName, columnName) {
  if (!(await tableExists(db, tableName))) {
    // console.log(`[SCHEMA FIX] Tabela '${tableName}' não encontrada, então a coluna '${columnName}' não pode existir.`);
    return false; // Column can't exist if table doesn't
  }
  try {
    const tableInfo = await db.all(`PRAGMA table_info(${tableName});`);
    return tableInfo.some(column => column.name === columnName);
  } catch (error) {
    console.error(`[SCHEMA FIX] Erro ao verificar a coluna '${columnName}' na tabela '${tableName}':`, error);
    return false; // Assume not exists on error
  }
}

async function fixCartItemsTable(db) {
  const tableName = 'cart_items';
  const columnName = 'category';
  console.log(`[SCHEMA FIX] 🔧 Verificando tabela '${tableName}' para coluna '${columnName}'...`);

  const cartItemsTableExists = await tableExists(db, tableName);

  if (!cartItemsTableExists) {
    console.warn(`[SCHEMA FIX] ⚠️ Tabela '${tableName}' NÃO ENCONTRADA. Pulando adição da coluna '${columnName}'. Esta tabela deveria ter sido criada pelas migrações.`);
    // It's critical that migrations handle table creation.
    // If it's missing here, something is wrong with the migration process or DB state.
    return; // Stop here for this fix if table doesn't exist.
  }

  console.log(`[SCHEMA FIX] ℹ️ Tabela '${tableName}' encontrada.`);
  const categoryColumnExistsInCartItems = await columnExists(db, tableName, columnName);

  if (!categoryColumnExistsInCartItems) {
    console.log(`[SCHEMA FIX] ➕ Coluna '${columnName}' não encontrada na tabela '${tableName}'. Tentando adicionar...`);
    try {
      await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT;`);
      console.log(`[SCHEMA FIX] ✅ Coluna '${columnName}' adicionada com sucesso à tabela '${tableName}'.`);
    } catch (err) {
      console.error(`[SCHEMA FIX] ❌ Erro FATAL ao adicionar coluna '${columnName}' à tabela '${tableName}': ${err.message}`, err);
      // Depending on severity, you might want to throw err here to stop the bot.
      // throw err; // Uncomment to make this a hard stop.
    }
  } else {
    console.log(`[SCHEMA FIX] 👍 Coluna '${columnName}' já existe na tabela '${tableName}'. Nenhuma ação necessária.`);
  }
}


async function fixUsersTableForTotalDonated(db) {
    const tableName = 'users';
    const columnName = 'total_donated';
    console.log(`[SCHEMA FIX] 🔧 Verificando tabela '${tableName}' para coluna '${columnName}'...`);

    if (!(await tableExists(db, tableName))) {
        console.warn(`[SCHEMA FIX] ⚠️ Tabela '${tableName}' NÃO ENCONTRADA. Pulando adição da coluna '${columnName}'.`);
        return;
    }

    if (!(await columnExists(db, tableName, columnName))) {
        console.log(`[SCHEMA FIX] ➕ Coluna '${columnName}' não encontrada na tabela '${tableName}'. Tentando adicionar com DEFAULT 0...`);
        try {
            await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} INTEGER DEFAULT 0;`);
            console.log(`[SCHEMA FIX] ✅ Coluna '${columnName}' adicionada com sucesso à tabela '${tableName}'.`);
        } catch (err) {
            console.error(`[SCHEMA FIX] ❌ Erro ao adicionar coluna '${columnName}' à tabela '${tableName}': ${err.message}`, err);
        }
    } else {
        console.log(`[SCHEMA FIX] 👍 Coluna '${columnName}' já existe na tabela '${tableName}'.`);
    }
}


// Add other fix functions here following the same pattern
// async function fixAnotherTable(db) { ... }

async function applyDatabaseFixes(db) {
    console.log("--- [SCHEMA FIX] Iniciando verificação e aplicação de correções de esquema ---");
    
    await fixCartItemsTable(db);
    await fixUsersTableForTotalDonated(db); // Example: if you add more fixes
    // await fixAnotherTable(db); 
    // await fixYetAnotherTable(db);
    
    console.log("--- [SCHEMA FIX] Correções de esquema finalizadas ---");
}

module.exports = { applyDatabaseFixes };
