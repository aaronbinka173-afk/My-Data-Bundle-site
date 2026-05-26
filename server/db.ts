import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const DB_FILE_PATH = path.join(process.cwd(), 'data_db.json');

// Interface representation for the JSON DB structures
interface JsonDatabase {
  users: any[];
  bundles: any[];
  reseller_pricing: any[];
  orders: any[];
  payments: any[];
  reseller_accounts: any[];
  withdrawal_requests: any[];
  data_delivery_logs: any[];
  admin_settings: Record<string, any>;
  sms_logs?: any[];
}

let pool: Pool | null = null;
const isPg = !!process.env.DATABASE_URL;

if (isPg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// Ensure database tables exist if using Postgres
export async function initDb() {
  if (isPg && pool) {
    try {
      console.log('Initializing PostgreSQL database...');
      // Build Tables:
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          store_name VARCHAR(255),
          store_slug VARCHAR(255) UNIQUE,
          phone VARCHAR(50),
          registration_fee_paid_ghs DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS bundles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          network VARCHAR(50) NOT NULL,
          data_amount VARCHAR(50),
          validity_days INT,
          admin_base_price_ghs DECIMAL(10,2) NOT NULL,
          provider_plan_code VARCHAR(100),
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reseller_pricing (
          id SERIAL PRIMARY KEY,
          reseller_id INT REFERENCES users(id) ON DELETE CASCADE,
          bundle_id INT REFERENCES bundles(id) ON DELETE CASCADE,
          markup_type VARCHAR(20),
          markup_value DECIMAL(10,2),
          final_price_ghs DECIMAL(10,2),
          UNIQUE(reseller_id, bundle_id)
        );

        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_ref VARCHAR(100) UNIQUE NOT NULL,
          customer_id INT REFERENCES users(id),
          reseller_id INT REFERENCES users(id),
          bundle_id INT REFERENCES bundles(id),
          customer_phone VARCHAR(50) NOT NULL,
          admin_base_price_ghs DECIMAL(10,2),
          reseller_markup_ghs DECIMAL(10,2),
          final_price_ghs DECIMAL(10,2),
          admin_fee_ghs DECIMAL(10,2) DEFAULT 0,
          net_to_reseller_ghs DECIMAL(10,2) DEFAULT 0,
          delivery_status VARCHAR(50) DEFAULT 'pending',
          payment_status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id) ON DELETE CASCADE,
          transaction_ref VARCHAR(255) UNIQUE NOT NULL,
          provider VARCHAR(50),
          amount_ghs DECIMAL(10,2),
          customer_email VARCHAR(255),
          customer_phone VARCHAR(50),
          status VARCHAR(50),
          webhook_payload TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reseller_accounts (
          user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          balance_ghs DECIMAL(10,2) DEFAULT 0,
          total_earned_ghs DECIMAL(10,2) DEFAULT 0,
          total_customers INT DEFAULT 0,
          deduction_source VARCHAR(50) DEFAULT 'storefront_earnings'
        );

        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id SERIAL PRIMARY KEY,
          reseller_id INT REFERENCES users(id) ON DELETE CASCADE,
          amount_ghs DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          decline_reason TEXT,
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS data_delivery_logs (
          id SERIAL PRIMARY KEY,
          order_id INT REFERENCES orders(id) ON DELETE CASCADE,
          api_provider VARCHAR(50),
          request_payload TEXT,
          response TEXT,
          status VARCHAR(50),
          retry_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS admin_settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE,
          setting_value TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sms_logs (
          id SERIAL PRIMARY KEY,
          reseller_id INT REFERENCES users(id) ON DELETE CASCADE,
          sender_id VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Seed admin if not exist
      const checkAdmin = await pool.query("SELECT * FROM users WHERE role = 'admin'");
      if (checkAdmin.rowCount === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.query(
          "INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4)",
          ['admin@machub.com', hash, 'admin', 'active']
        );
      }

      // Seed basic settings
      await insertSettingIfNotExist('registration_fee_ghs', '50');
      await insertSettingIfNotExist('registration_fee_enabled', 'true');
      await insertSettingIfNotExist('max_markup_percent', '50');
      await insertSettingIfNotExist('admin_fee_percent', '2');
      await insertSettingIfNotExist('admin_fee_source', 'storefront_earnings');
      await insertSettingIfNotExist('test_mode_enabled', 'true');
      await insertSettingIfNotExist('withdrawal_fee_percent', '0');
      await insertSettingIfNotExist('data_api_username', 'mock_username');
      await insertSettingIfNotExist('data_api_key', 'mock_api_key');
      await insertSettingIfNotExist('data_api_url', 'https://subandgain.com/api/data.php');

      // Alter withdrawal_requests with fee columns
      await pool.query(`
        ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_ghs DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS net_amount_ghs DECIMAL(10,2) DEFAULT 0;
      `).catch(err => {
        console.error('Migration error adding fee columns to withdrawal_requests:', err);
      });

      // Seed default bundles
      const checkBundles = await pool.query('SELECT * FROM bundles');
      if (checkBundles.rowCount === 0) {
        const defaultBundles = [
          ['MTN 1.5GB Data', 'MTN', '1.5GB', 30, 10.00, 'mtn-1.5gb'],
          ['MTN 5GB Mega', 'MTN', '5GB', 30, 30.00, 'mtn-5gb'],
          ['Telecel 2GB Flat', 'Vodafone', '2GB', 30, 12.00, 'voda-2gb'],
          ['AirtelTigo 3GB Super', 'AirtelTigo', '3GB', 30, 11.00, 'tigo-3gb'],
        ];
        for (const b of defaultBundles) {
          await pool.query(
            'INSERT INTO bundles (name, network, data_amount, validity_days, admin_base_price_ghs, provider_plan_code, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [b[0], b[1], b[2], b[3], b[4], b[5], 'active']
          );
        }
      }

      console.log('PostgreSQL initialized and seeded.');
    } catch (e) {
      console.error('Failed to initialize PostgreSQL. Falling back to JSON database.', e);
    }
  } else {
    // Local JSON Db initialization:
    if (!fs.existsSync(DB_FILE_PATH)) {
      console.log('Initializing local JSON database...');
      const adminHash = await bcrypt.hash('admin123', 10);
      const initialData: JsonDatabase = {
        users: [
          {
            id: 1,
            email: 'admin@machub.com',
            password_hash: adminHash,
            role: 'admin',
            status: 'active',
            registration_fee_paid_ghs: 0,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            email: 'reseller@machub.com',
            password_hash: await bcrypt.hash('reseller123', 10),
            role: 'reseller',
            status: 'active',
            store_name: 'Mac Express Data',
            store_slug: 'mac-express',
            phone: '0241234567',
            registration_fee_paid_ghs: 50.00,
            created_at: new Date().toISOString()
          }
        ],
        bundles: [
          {
            id: 1,
            name: 'MTN 1.5GB Data',
            network: 'MTN',
            data_amount: '1.5GB',
            validity_days: 30,
            admin_base_price_ghs: 10.00,
            provider_plan_code: 'mtn-1.5gb',
            status: 'active',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            name: 'MTN 5GB Mega',
            network: 'MTN',
            data_amount: '5GB',
            validity_days: 30,
            admin_base_price_ghs: 30.00,
            provider_plan_code: 'mtn-5gb',
            status: 'active',
            created_at: new Date().toISOString()
          },
          {
            id: 3,
            name: 'Telecel 2GB Flat',
            network: 'Vodafone',
            data_amount: '2GB',
            validity_days: 30,
            admin_base_price_ghs: 12.00,
            provider_plan_code: 'voda-2gb',
            status: 'active',
            created_at: new Date().toISOString()
          },
          {
            id: 4,
            name: 'AirtelTigo 3GB Super',
            network: 'AirtelTigo',
            data_amount: '3GB',
            validity_days: 30,
            admin_base_price_ghs: 11.00,
            provider_plan_code: 'tigo-3gb',
            status: 'active',
            created_at: new Date().toISOString()
          }
        ],
        reseller_pricing: [
          {
            id: 1,
            reseller_id: 2,
            bundle_id: 1,
            markup_type: 'fixed',
            markup_value: 2.00,
            final_price_ghs: 12.00
          },
          {
            id: 2,
            reseller_id: 2,
            bundle_id: 2,
            markup_type: 'percentage',
            markup_value: 10,
            final_price_ghs: 33.00
          }
        ],
        orders: [
          {
            id: 1,
            order_ref: 'ORD-1001-A',
            customer_id: 1,
            reseller_id: 2,
            bundle_id: 1,
            customer_phone: '0249876543',
            admin_base_price_ghs: 10.00,
            reseller_markup_ghs: 2.00,
            final_price_ghs: 12.00,
            admin_fee_ghs: 0.24,
            net_to_reseller_ghs: 1.76,
            delivery_status: 'delivered',
            payment_status: 'paid',
            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
          },
          {
            id: 2,
            order_ref: 'ORD-1002-B',
            customer_id: 1,
            reseller_id: null,
            bundle_id: 2,
            customer_phone: '0501112223',
            admin_base_price_ghs: 30.00,
            reseller_markup_ghs: 0.00,
            final_price_ghs: 30.00,
            admin_fee_ghs: 0.00,
            net_to_reseller_ghs: 0.00,
            delivery_status: 'failed',
            payment_status: 'paid',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString()
          }
        ],
        payments: [
          {
            id: 1,
            order_id: 1,
            transaction_ref: 'FLW-TX-11111',
            provider: 'flutterwave',
            amount_ghs: 12.00,
            customer_email: 'buyer@example.com',
            customer_phone: '0249876543',
            status: 'success',
            webhook_payload: '{"verified": true}',
            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
          }
        ],
        reseller_accounts: [
          {
            user_id: 2,
            balance_ghs: 151.76,
            total_earned_ghs: 151.76,
            total_customers: 1,
            deduction_source: 'storefront_earnings'
          }
        ],
        withdrawal_requests: [
          {
            id: 1,
            reseller_id: 2,
            amount_ghs: 30.00,
            status: 'approved',
            processed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
          }
        ],
        data_delivery_logs: [
          {
            id: 1,
            order_id: 1,
            api_provider: 'subandgain',
            request_payload: '{"phoneNumber": "0249876543", "dataPlan": "mtn-1.5gb", "network": "MTN"}',
            response: '{"status": "Approved", "trans_id": "SG-99818A", "api_response": "Processed successfully"}',
            status: 'success',
            retry_count: 0,
            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
          },
          {
            id: 2,
            order_id: 2,
            api_provider: 'subandgain',
            request_payload: '{"phoneNumber": "0501112223", "dataPlan": "mtn-5gb", "network": "MTN"}',
            response: '{"status": "Failed", "error": "Insufficient partner credit balance"}',
            status: 'failed',
            retry_count: 1,
            created_at: new Date(Date.now() - 3600000 * 24).toISOString()
          }
        ],
        admin_settings: {
          registration_fee_ghs: 50.00,
          registration_fee_enabled: true,
          max_markup_percent: 50.00,
          admin_fee_percent: 2.00,
          admin_fee_source: 'storefront_earnings',
          test_mode_enabled: true
        }
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialData, null, 2));
      console.log('Seed JSON database created.');
    }

    // Auto-seed/promote owner email as admin in JSON database
    try {
      const jdb = loadJsonDb();
      const userIndex = jdb.users.findIndex(u => u.email.toLowerCase() === 'aaronbinka173@gmail.com');
      const adminHash = await bcrypt.hash('admin123', 10);
      if (userIndex === -1) {
        const newId = jdb.users.length > 0 ? Math.max(...jdb.users.map(u => u.id)) + 1 : 1;
        jdb.users.push({
          id: newId,
          email: 'aaronbinka173@gmail.com',
          password_hash: adminHash,
          role: 'admin',
          status: 'active',
          registration_fee_paid_ghs: 0,
          created_at: new Date().toISOString()
        });
        saveJsonDb(jdb);
        console.log('Owner email seeded as admin.');
      } else if (jdb.users[userIndex].role !== 'admin') {
        jdb.users[userIndex].role = 'admin';
        jdb.users[userIndex].status = 'active';
        saveJsonDb(jdb);
        console.log('Owner email promoted to admin.');
      }
    } catch (err) {
      console.error('Failed to auto-seed json owner email:', err);
    }
  }

  // Auto-seed/promote owner email as admin in PostgreSQL database if active
  if (isPg && pool) {
    try {
      const checkUser = await pool.query("SELECT * FROM users WHERE LOWER(email) = 'aaronbinka173@gmail.com'");
      if (checkUser.rowCount === 0) {
        const adminHash = await bcrypt.hash('admin123', 10);
        await pool.query(
          "INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4)",
          ['aaronbinka173@gmail.com', adminHash, 'admin', 'active']
        );
        console.log('Owner email seeded as admin in Postgres.');
      } else if (checkUser.rows[0].role !== 'admin') {
        await pool.query("UPDATE users SET role = 'admin', status = 'active' WHERE LOWER(email) = 'aaronbinka173@gmail.com'");
        console.log('Owner email promoted to admin in Postgres.');
      }
    } catch (err) {
      console.error('Failed to auto-seed Postgres owner email:', err);
    }
  }
}

async function insertSettingIfNotExist(key: string, value: string) {
  if (pool) {
    const check = await pool.query('SELECT * FROM admin_settings WHERE setting_key = $1', [key]);
    if (check.rowCount === 0) {
      await pool.query('INSERT INTO admin_settings (setting_key, setting_value) VALUES ($1, $2)', [key, value]);
    }
  }
}

// Low-level helper to load local JSON Database
function loadJsonDb(): JsonDatabase {
  if (!fs.existsSync(DB_FILE_PATH)) {
    return {
      users: [],
      bundles: [],
      reseller_pricing: [],
      orders: [],
      payments: [],
      reseller_accounts: [],
      withdrawal_requests: [],
      data_delivery_logs: [],
      admin_settings: {},
      sms_logs: []
    };
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
  if (!data.sms_logs) {
    data.sms_logs = [];
  }
  return data;
}

// Low-level helper to save local JSON Database
function saveJsonDb(data: JsonDatabase) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
}

// UNIFIED HIGH LEVEL DATABASE OPERATIONS
export const db = {
  // --- USERS ---
  async getUsers(role?: string): Promise<any[]> {
    if (isPg && pool) {
      const q = role ? "SELECT * FROM users WHERE role = $1 ORDER BY id DESC" : "SELECT * FROM users ORDER BY id DESC";
      const params = role ? [role] : [];
      const res = await pool.query(q, params);
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return role ? jdb.users.filter(u => u.role === role) : jdb.users;
    }
  },

  async getUserById(id: number): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      return jdb.users.find(u => u.id === id) || null;
    }
  },

  async getUserByEmail(email: string): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      return jdb.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  async getUserByStoreSlug(slug: string): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM users WHERE store_slug = $1", [slug]);
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      return jdb.users.find(u => u.store_slug === slug) || null;
    }
  },

  async createUser(user: {
    email: string;
    password_hash: string;
    role: string;
    status?: string;
    store_name?: string;
    store_slug?: string;
    phone?: string;
    registration_fee_paid_ghs?: number;
  }): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO users 
        (email, password_hash, role, status, store_name, store_slug, phone, registration_fee_paid_ghs) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          user.email.toLowerCase(),
          user.password_hash,
          user.role,
          user.status || 'active',
          user.store_name || null,
          user.store_slug || null,
          user.phone || null,
          user.registration_fee_paid_ghs || 0
        ]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.users.length > 0 ? Math.max(...jdb.users.map(u => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        email: user.email.toLowerCase(),
        password_hash: user.password_hash,
        role: user.role,
        status: user.status || 'active',
        store_name: user.store_name || null,
        store_slug: user.store_slug || null,
        phone: user.phone || null,
        registration_fee_paid_ghs: user.registration_fee_paid_ghs || 0,
        created_at: new Date().toISOString()
      };
      jdb.users.push(newUser);
      saveJsonDb(jdb);
      return newUser;
    }
  },

  async updateUserStatus(id: number, status: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const user = jdb.users.find(u => u.id === id);
      if (user) {
        user.status = status;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  async updateUserRole(id: number, role: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const user = jdb.users.find(u => u.id === id);
      if (user) {
        user.role = role;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  async updateUserPassword(id: number, passwordHash: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const user = jdb.users.find(u => u.id === id);
      if (user) {
        user.password_hash = passwordHash;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  async createSmsLog(resellerId: number | null, senderId: string, message: string, status: string): Promise<any> {
    const createdAt = new Date().toISOString();
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO sms_logs (reseller_id, sender_id, message, status, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [resellerId, senderId, message, status]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.sms_logs && jdb.sms_logs.length > 0 ? Math.max(...jdb.sms_logs.map(log => log.id || 0)) + 1 : 1;
      const logObj = {
        id: newId,
        reseller_id: resellerId,
        sender_id: senderId,
        message,
        status,
        created_at: createdAt
      };
      if (!jdb.sms_logs) {
        jdb.sms_logs = [];
      }
      jdb.sms_logs.push(logObj);
      saveJsonDb(jdb);
      return logObj;
    }
  },

  async getSmsLogs(): Promise<any[]> {
    if (isPg && pool) {
      const res = await pool.query(
        `SELECT l.*, u.store_name, u.email 
         FROM sms_logs l 
         LEFT JOIN users u ON l.reseller_id = u.id 
         ORDER BY l.id DESC LIMIT 100`
      );
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      const logs = jdb.sms_logs || [];
      const users = jdb.users || [];
      const joined = logs.map(l => {
        const u = users.find(user => user.id === l.reseller_id);
        return {
          ...l,
          store_name: u ? u.store_name : null,
          email: u ? u.email : null
        };
      });
      // Sort desc
      return joined.sort((a, b) => b.id - a.id).slice(0, 100);
    }
  },

  // --- BUNDLES ---
  async getBundles(statusOnlyActive?: boolean): Promise<any[]> {
    if (isPg && pool) {
      const q = statusOnlyActive ? "SELECT * FROM bundles WHERE status = 'active' ORDER BY admin_base_price_ghs ASC" : "SELECT * FROM bundles ORDER BY id DESC";
      const res = await pool.query(q);
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return statusOnlyActive ? jdb.bundles.filter(b => b.status === 'active') : jdb.bundles;
    }
  },

  async getBundleById(id: number): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM bundles WHERE id = $1", [id]);
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      return jdb.bundles.find(b => b.id === id) || null;
    }
  },

  async createBundle(bundle: {
    name: string;
    network: string;
    data_amount: string;
    validity_days: number;
    admin_base_price_ghs: number;
    provider_plan_code: string;
    status?: string;
  }): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO bundles (name, network, data_amount, validity_days, admin_base_price_ghs, provider_plan_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [bundle.name, bundle.network, bundle.data_amount, bundle.validity_days, bundle.admin_base_price_ghs, bundle.provider_plan_code, bundle.status || 'active']
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.bundles.length > 0 ? Math.max(...jdb.bundles.map(b => b.id)) + 1 : 1;
      const newBundle = {
        id: newId,
        name: bundle.name,
        network: bundle.network,
        data_amount: bundle.data_amount,
        validity_days: bundle.validity_days,
        admin_base_price_ghs: Number(bundle.admin_base_price_ghs),
        provider_plan_code: bundle.provider_plan_code,
        status: bundle.status || 'active',
        created_at: new Date().toISOString()
      };
      jdb.bundles.push(newBundle);
      saveJsonDb(jdb);
      return newBundle;
    }
  },

  async updateBundle(id: number, bundle: {
    name: string;
    network: string;
    data_amount: string;
    validity_days: number;
    admin_base_price_ghs: number;
    provider_plan_code: string;
    status: string;
  }): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query(
        `UPDATE bundles SET name = $1, network = $2, data_amount = $3, validity_days = $4, admin_base_price_ghs = $5, provider_plan_code = $6, status = $7
         WHERE id = $8 RETURNING *`,
        [bundle.name, bundle.network, bundle.data_amount, bundle.validity_days, bundle.admin_base_price_ghs, bundle.provider_plan_code, bundle.status, id]
      );
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      const index = jdb.bundles.findIndex(b => b.id === id);
      if (index > -1) {
        jdb.bundles[index] = {
          ...jdb.bundles[index],
          name: bundle.name,
          network: bundle.network,
          data_amount: bundle.data_amount,
          validity_days: Number(bundle.validity_days),
          admin_base_price_ghs: Number(bundle.admin_base_price_ghs),
          provider_plan_code: bundle.provider_plan_code,
          status: bundle.status
        };
        saveJsonDb(jdb);
        return jdb.bundles[index];
      }
      return null;
    }
  },

  async deleteBundle(id: number): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("DELETE FROM bundles WHERE id = $1", [id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const filtered = jdb.bundles.filter(b => b.id !== id);
      const isDeleted = filtered.length !== jdb.bundles.length;
      jdb.bundles = filtered;
      saveJsonDb(jdb);
      return isDeleted;
    }
  },

  // --- RESELLER PRICING ---
  async getResellerPricings(resellerId: number): Promise<any[]> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM reseller_pricing WHERE reseller_id = $1", [resellerId]);
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return jdb.reseller_pricing.filter(p => p.reseller_id === resellerId);
    }
  },

  async saveResellerPricing(resellerId: number, bundleId: number, markupType: 'fixed' | 'percentage', markupValue: number, finalPrice: number): Promise<any> {
    if (isPg && pool) {
      const check = await pool.query(
        "SELECT id FROM reseller_pricing WHERE reseller_id = $1 AND bundle_id = $2",
        [resellerId, bundleId]
      );
      if (check.rowCount > 0) {
        const res = await pool.query(
          `UPDATE reseller_pricing SET markup_type = $1, markup_value = $2, final_price_ghs = $3 
           WHERE reseller_id = $4 AND bundle_id = $5 RETURNING *`,
          [markupType, markupValue, finalPrice, resellerId, bundleId]
        );
        return res.rows[0];
      } else {
        const res = await pool.query(
          `INSERT INTO reseller_pricing (reseller_id, bundle_id, markup_type, markup_value, final_price_ghs) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [resellerId, bundleId, markupType, markupValue, finalPrice]
        );
        return res.rows[0];
      }
    } else {
      const jdb = loadJsonDb();
      let priceRecord = jdb.reseller_pricing.find(p => p.reseller_id === resellerId && p.bundle_id === bundleId);
      if (priceRecord) {
        priceRecord.markup_type = markupType;
        priceRecord.markup_value = Number(markupValue);
        priceRecord.final_price_ghs = Number(finalPrice);
      } else {
        const newId = jdb.reseller_pricing.length > 0 ? Math.max(...jdb.reseller_pricing.map(p => p.id)) + 1 : 1;
        priceRecord = {
          id: newId,
          reseller_id: resellerId,
          bundle_id: bundleId,
          markup_type: markupType,
          markup_value: Number(markupValue),
          final_price_ghs: Number(finalPrice)
        };
        jdb.reseller_pricing.push(priceRecord);
      }
      saveJsonDb(jdb);
      return priceRecord;
    }
  },

  // --- ORDERS & CUSTOMERS ---
  async getOrders(resellerId?: number | null): Promise<any[]> {
    const rawOrders = await this._getRawOrders();
    const formatted: any[] = [];
    const bundles = await this.getBundles();
    const users = await this.getUsers();

    for (const o of rawOrders) {
      if (resellerId !== undefined && o.reseller_id !== resellerId) {
        continue;
      }
      const b = bundles.find(x => x.id === o.bundle_id);
      const cust = users.find(x => x.id === o.customer_id);
      const res = o.reseller_id ? users.find(x => x.id === o.reseller_id) : null;

      formatted.push({
        ...o,
        customer_email: cust ? cust.email : 'Guest Customer',
        reseller_store_name: res ? res.store_name : null,
        bundle_name: b ? b.name : 'Unknown Bundle',
        bundle_network: b ? b.network : 'Unknown',
        bundle_data_amount: b ? b.data_amount : '',
        admin_base_price_ghs: Number(o.admin_base_price_ghs),
        reseller_markup_ghs: Number(o.reseller_markup_ghs),
        final_price_ghs: Number(o.final_price_ghs),
        admin_fee_ghs: Number(o.admin_fee_ghs),
        net_to_reseller_ghs: Number(o.net_to_reseller_ghs)
      });
    }
    return formatted.sort((a,b) => b.id - a.id);
  },

  async _getRawOrders(): Promise<any[]> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM orders ORDER BY id DESC");
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return jdb.orders;
    }
  },

  async getOrderById(id: number): Promise<any | null> {
    const orders = await this.getOrders();
    return orders.find(o => o.id === id) || null;
  },

  async getOrderByRef(ref: string): Promise<any | null> {
    const orders = await this.getOrders();
    return orders.find(o => o.order_ref === ref) || null;
  },

  async createOrder(order: {
    order_ref: string;
    customer_id: number;
    reseller_id: number | null;
    bundle_id: number;
    customer_phone: string;
    admin_base_price_ghs: number;
    reseller_markup_ghs: number;
    final_price_ghs: number;
    admin_fee_ghs: number;
    net_to_reseller_ghs: number;
    delivery_status?: string;
    payment_status?: string;
  }): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO orders 
        (order_ref, customer_id, reseller_id, bundle_id, customer_phone, admin_base_price_ghs, reseller_markup_ghs, final_price_ghs, admin_fee_ghs, net_to_reseller_ghs, delivery_status, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          order.order_ref,
          order.customer_id,
          order.reseller_id,
          order.bundle_id,
          order.customer_phone,
          order.admin_base_price_ghs,
          order.reseller_markup_ghs,
          order.final_price_ghs,
          order.admin_fee_ghs,
          order.net_to_reseller_ghs,
          order.delivery_status || 'pending',
          order.payment_status || 'pending'
        ]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.orders.length > 0 ? Math.max(...jdb.orders.map(o => o.id)) + 1 : 1;
      const newOrder = {
        id: newId,
        order_ref: order.order_ref,
        customer_id: order.customer_id,
        reseller_id: order.reseller_id,
        bundle_id: order.bundle_id,
        customer_phone: order.customer_phone,
        admin_base_price_ghs: Number(order.admin_base_price_ghs),
        reseller_markup_ghs: Number(order.reseller_markup_ghs),
        final_price_ghs: Number(order.final_price_ghs),
        admin_fee_ghs: Number(order.admin_fee_ghs),
        net_to_reseller_ghs: Number(order.net_to_reseller_ghs),
        delivery_status: order.delivery_status || 'pending',
        payment_status: order.payment_status || 'pending',
        created_at: new Date().toISOString()
      };
      jdb.orders.push(newOrder);
      saveJsonDb(jdb);
      return newOrder;
    }
  },

  async updateOrderStatus(id: number, paymentStatus: string, deliveryStatus: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE orders SET payment_status = $1, delivery_status = $2 WHERE id = $3", [paymentStatus, deliveryStatus, id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const o = jdb.orders.find(x => x.id === id);
      if (o) {
        o.payment_status = paymentStatus;
        o.delivery_status = deliveryStatus;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  async updateOrderDeliveryStatus(id: number, deliveryStatus: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE orders SET delivery_status = $1 WHERE id = $2", [deliveryStatus, id]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const o = jdb.orders.find(x => x.id === id);
      if (o) {
        o.delivery_status = deliveryStatus;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  // --- RESELLER ACCOUNTS ---
  async getResellerAccounts(): Promise<any[]> {
    const rawResellers = await this.getUsers('reseller');
    const rawAdmins = await this.getUsers('admin');
    const filteredAdmins = rawAdmins.filter(u => u.email.toLowerCase() !== 'aaronbinka173@gmail.com' && u.email.toLowerCase() !== 'admin@machub.com');
    const rawUsers = [...rawResellers, ...filteredAdmins];
    
    // De-duplicate just in case
    const uniqueUsers: any[] = [];
    const seenIds = new Set<number>();
    for (const u of rawUsers) {
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id);
        uniqueUsers.push(u);
      }
    }

    const accounts: any[] = [];
    for (const user of uniqueUsers) {
      let acc = await this.getResellerAccountByUserId(user.id);
      if (!acc) {
        acc = await this.createResellerAccount(user.id);
      }
      accounts.push({
        ...acc,
        email: user.email,
        store_name: user.store_name,
        store_slug: user.store_slug,
        status: user.status,
        role: user.role
      });
    }
    return accounts;
  },

  async getResellerAccountByUserId(userId: number): Promise<any | null> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM reseller_accounts WHERE user_id = $1", [userId]);
      return res.rows[0] || null;
    } else {
      const jdb = loadJsonDb();
      return jdb.reseller_accounts.find(a => a.user_id === userId) || null;
    }
  },

  async createResellerAccount(userId: number, initialBalance: number = 0): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO reseller_accounts (user_id, balance_ghs, total_earned_ghs, total_customers, deduction_source)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *`,
        [userId, initialBalance, initialBalance, 0, 'storefront_earnings']
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      let acc = jdb.reseller_accounts.find(a => a.user_id === userId);
      if (!acc) {
        acc = {
          user_id: userId,
          balance_ghs: Number(initialBalance),
          total_earned_ghs: Number(initialBalance),
          total_customers: 0,
          deduction_source: 'storefront_earnings'
        };
        jdb.reseller_accounts.push(acc);
        saveJsonDb(jdb);
      }
      return acc;
    }
  },

  async incrementResellerAccount(userId: number, amountGhs: number, isNewCustomer: boolean): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `UPDATE reseller_accounts 
         SET balance_ghs = balance_ghs + $1, 
             total_earned_ghs = total_earned_ghs + $1,
             total_customers = total_customers + $2
         WHERE user_id = $3 RETURNING *`,
        [amountGhs, isNewCustomer ? 1 : 0, userId]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      let acc = jdb.reseller_accounts.find(a => a.user_id === userId);
      if (!acc) {
        acc = await this.createResellerAccount(userId);
      }
      acc.balance_ghs = Number((acc.balance_ghs + amountGhs).toFixed(2));
      acc.total_earned_ghs = Number((acc.total_earned_ghs + amountGhs).toFixed(2));
      if (isNewCustomer) {
        acc.total_customers += 1;
      }
      saveJsonDb(jdb);
      return acc;
    }
  },

  async deductResellerBalance(userId: number, amountGhs: number): Promise<boolean> {
    if (isPg && pool) {
      const res = await pool.query(
        "UPDATE reseller_accounts SET balance_ghs = balance_ghs - $1 WHERE user_id = $2 AND balance_ghs >= $1 RETURNING *",
        [amountGhs, userId]
      );
      return res.rowCount > 0;
    } else {
      const jdb = loadJsonDb();
      const acc = jdb.reseller_accounts.find(a => a.user_id === userId);
      if (acc && acc.balance_ghs >= amountGhs) {
        acc.balance_ghs = Number((acc.balance_ghs - amountGhs).toFixed(2));
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  async updateResellerDeductionSource(userId: number, source: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query("UPDATE reseller_accounts SET deduction_source = $1 WHERE user_id = $2", [source, userId]);
      return true;
    } else {
      const jdb = loadJsonDb();
      const acc = jdb.reseller_accounts.find(a => a.user_id === userId);
      if (acc) {
        acc.deduction_source = source;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  // --- WITHDRAWALS ---
  async getWithdrawals(resellerId?: number): Promise<any[]> {
    if (isPg && pool) {
      const q = resellerId 
        ? "SELECT w.*, u.store_name as reseller_store_name, u.email as reseller_email FROM withdrawal_requests w JOIN users u ON w.reseller_id = u.id WHERE w.reseller_id = $1 ORDER BY w.id DESC"
        : "SELECT w.*, u.store_name as reseller_store_name, u.email as reseller_email FROM withdrawal_requests w JOIN users u ON w.reseller_id = u.id ORDER BY w.id DESC";
      const params = resellerId ? [resellerId] : [];
      const res = await pool.query(q, params);
      return res.rows.map(r => {
        const fee = r.fee_ghs !== null && r.fee_ghs !== undefined ? Number(r.fee_ghs) : 0;
        const net = r.net_amount_ghs !== null && r.net_amount_ghs !== undefined ? Number(r.net_amount_ghs) : Number(r.amount_ghs);
        return {
          ...r,
          fee_ghs: fee,
          net_amount_ghs: net
        };
      });
    } else {
      const jdb = loadJsonDb();
      const list = resellerId ? jdb.withdrawal_requests.filter(w => w.reseller_id === resellerId) : jdb.withdrawal_requests;
      const settings = jdb.admin_settings || {};
      const feePercent = Number(settings.withdrawal_fee_percent) || 0;
      return list.map(w => {
        const u = jdb.users.find(x => x.id === w.reseller_id);
        const computedFee = w.fee_ghs !== undefined ? w.fee_ghs : Number(((w.amount_ghs * feePercent) / 100).toFixed(2));
        const computedNet = w.net_amount_ghs !== undefined ? w.net_amount_ghs : Number((w.amount_ghs - computedFee).toFixed(2));
        return {
          ...w,
          fee_ghs: computedFee,
          net_amount_ghs: computedNet,
          reseller_store_name: u ? u.store_name : 'Unknown Store',
          reseller_email: u ? u.email : 'Unknown Email'
        };
      }).sort((a,b) => b.id - a.id);
    }
  },

  async createWithdrawal(resellerId: number, amountGhs: number): Promise<any> {
    const settings = await this.getSettings();
    const feeGhs = Number(((amountGhs * (Number(settings.withdrawal_fee_percent) || 0)) / 100).toFixed(2));
    const netAmountGhs = Number((amountGhs - feeGhs).toFixed(2));

    if (isPg && pool) {
      const res = await pool.query(
        "INSERT INTO withdrawal_requests (reseller_id, amount_ghs, fee_ghs, net_amount_ghs, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *",
        [resellerId, amountGhs, feeGhs, netAmountGhs]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.withdrawal_requests.length > 0 ? Math.max(...jdb.withdrawal_requests.map(w => w.id)) + 1 : 1;
      const newW = {
        id: newId,
        reseller_id: resellerId,
        amount_ghs: Number(amountGhs),
        fee_ghs: feeGhs,
        net_amount_ghs: netAmountGhs,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      jdb.withdrawal_requests.push(newW);
      saveJsonDb(jdb);
      return newW;
    }
  },

  async processWithdrawal(id: number, status: 'approved' | 'declined', reason?: string): Promise<boolean> {
    if (isPg && pool) {
      const processedAt = new Date();
      if (status === 'approved') {
        const wReq = await pool.query("SELECT reseller_id, amount_ghs FROM withdrawal_requests WHERE id = $1 AND status = 'pending'", [id]);
        if (wReq.rowCount === 0) return false;
        const { reseller_id, amount_ghs } = wReq.rows[0];
        // Deduct from reseller balance
        const success = await this.deductResellerBalance(reseller_id, Number(amount_ghs));
        if (!success) {
          return false;
        }
      }
      await pool.query(
        "UPDATE withdrawal_requests SET status = $1, decline_reason = $2, processed_at = $3 WHERE id = $4",
        [status, reason || null, processedAt, id]
      );
      return true;
    } else {
      const jdb = loadJsonDb();
      const w = jdb.withdrawal_requests.find(x => x.id === id);
      if (w && w.status === 'pending') {
        if (status === 'approved') {
          const success = await this.deductResellerBalance(w.reseller_id, w.amount_ghs);
          if (!success) return false;
        }
        w.status = status;
        w.decline_reason = reason || null;
        w.processed_at = new Date().toISOString();
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  // --- PAYMENTS ---
  async getPayments(): Promise<any[]> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM payments ORDER BY id DESC");
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return jdb.payments;
    }
  },

  async createPaymentLog(log: {
    order_id: number;
    transaction_ref: string;
    provider: string;
    amount_ghs: number;
    customer_email: string;
    customer_phone: string;
    status: string;
    webhook_payload?: string;
  }): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO payments (order_id, transaction_ref, provider, amount_ghs, customer_email, customer_phone, status, webhook_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [log.order_id, log.transaction_ref, log.provider, log.amount_ghs, log.customer_email, log.customer_phone, log.status, log.webhook_payload || null]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.payments.length > 0 ? Math.max(...jdb.payments.map(p => p.id)) + 1 : 1;
      const newPayment = {
        id: newId,
        order_id: log.order_id,
        transaction_ref: log.transaction_ref,
        provider: log.provider,
        amount_ghs: Number(log.amount_ghs),
        customer_email: log.customer_email,
        customer_phone: log.customer_phone,
        status: log.status,
        webhook_payload: log.webhook_payload || null,
        created_at: new Date().toISOString()
      };
      jdb.payments.push(newPayment);
      saveJsonDb(jdb);
      return newPayment;
    }
  },

  // --- DATA DELIVERY LOGS ---
  async getDeliveryLogs(): Promise<any[]> {
    if (isPg && pool) {
      const res = await pool.query(`
        SELECT d.*, o.order_ref, o.customer_phone, b.name as bundle_name
        FROM data_delivery_logs d
        JOIN orders o ON d.order_id = o.id
        LEFT JOIN bundles b ON o.bundle_id = b.id
        ORDER BY d.id DESC
      `);
      return res.rows;
    } else {
      const jdb = loadJsonDb();
      return jdb.data_delivery_logs.map(d => {
        const o = jdb.orders.find(x => x.id === d.order_id);
        const b = o ? jdb.bundles.find(x => x.id === o.bundle_id) : null;
        return {
          ...d,
          order_ref: o ? o.order_ref : 'Unknown',
          customer_phone: o ? o.customer_phone : 'Unknown',
          bundle_name: b ? b.name : 'Unknown'
        };
      }).sort((a,b) => b.id - a.id);
    }
  },

  async createDeliveryLog(log: {
    order_id: number;
    api_provider: string;
    request_payload: string;
    response: string;
    status: string;
    retry_count?: number;
  }): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query(
        `INSERT INTO data_delivery_logs (order_id, api_provider, request_payload, response, status, retry_count)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [log.order_id, log.api_provider, log.request_payload, log.response, log.status, log.retry_count || 0]
      );
      return res.rows[0];
    } else {
      const jdb = loadJsonDb();
      const newId = jdb.data_delivery_logs.length > 0 ? Math.max(...jdb.data_delivery_logs.map(d => d.id)) + 1 : 1;
      const newLog = {
        id: newId,
        order_id: log.order_id,
        api_provider: log.api_provider,
        request_payload: log.request_payload,
        response: log.response,
        status: log.status,
        retry_count: log.retry_count || 0,
        created_at: new Date().toISOString()
      };
      jdb.data_delivery_logs.push(newLog);
      saveJsonDb(jdb);
      return newLog;
    }
  },

  async incrementSandboxLogRetry(logId: number, status: string, response: string): Promise<boolean> {
    if (isPg && pool) {
      await pool.query(
        "UPDATE data_delivery_logs SET retry_count = retry_count + 1, status = $1, response = $2 WHERE id = $3",
        [status, response, logId]
      );
      return true;
    } else {
      const jdb = loadJsonDb();
      const log = jdb.data_delivery_logs.find(d => d.id === logId);
      if (log) {
        log.retry_count += 1;
        log.status = status;
        log.response = response;
        saveJsonDb(jdb);
        return true;
      }
      return false;
    }
  },

  // --- ADMIN SETTINGS ---
  async getSettings(): Promise<any> {
    if (isPg && pool) {
      const res = await pool.query("SELECT * FROM admin_settings");
      const settings: Record<string, any> = {};
      res.rows.forEach(r => {
        let val: any = r.setting_value;
        if (r.setting_key === 'registration_fee_enabled' || r.setting_key === 'test_mode_enabled') {
          val = r.setting_value === 'true';
        } else if (r.setting_key === 'registration_fee_ghs' || r.setting_key === 'max_markup_percent' || r.setting_key === 'admin_fee_percent' || r.setting_key === 'withdrawal_fee_percent') {
          val = Number(r.setting_value);
        }
        settings[r.setting_key] = val;
      });
      return {
        registration_fee_ghs: settings.registration_fee_ghs !== undefined ? settings.registration_fee_ghs : 50.00,
        registration_fee_enabled: settings.registration_fee_enabled !== undefined ? settings.registration_fee_enabled : true,
        max_markup_percent: settings.max_markup_percent !== undefined ? settings.max_markup_percent : 50.00,
        admin_fee_percent: settings.admin_fee_percent !== undefined ? settings.admin_fee_percent : 2.00,
        admin_fee_source: settings.admin_fee_source || 'storefront_earnings',
        test_mode_enabled: settings.test_mode_enabled !== undefined ? settings.test_mode_enabled : true,
        withdrawal_fee_percent: settings.withdrawal_fee_percent !== undefined ? Number(settings.withdrawal_fee_percent) : 0.00,
        payment_gateway: settings.payment_gateway || 'paystack',
        paystack_public_key: settings.paystack_public_key || '',
        paystack_secret_key: settings.paystack_secret_key || '',
        flutterwave_public_key: settings.flutterwave_public_key || '',
        flutterwave_secret_key: settings.flutterwave_secret_key || '',
        data_api_username: settings.data_api_username || '',
        data_api_key: settings.data_api_key || '',
        data_api_url: settings.data_api_url || 'https://subandgain.com/api/data.php',
      };
    } else {
      const jdb = loadJsonDb();
      if (!jdb.admin_settings) {
        jdb.admin_settings = {};
      }
      return {
        registration_fee_ghs: Number(jdb.admin_settings.registration_fee_ghs) || 50.00,
        registration_fee_enabled: jdb.admin_settings.registration_fee_enabled ?? true,
        max_markup_percent: Number(jdb.admin_settings.max_markup_percent) || 50.00,
        admin_fee_percent: Number(jdb.admin_settings.admin_fee_percent) || 2.00,
        admin_fee_source: jdb.admin_settings.admin_fee_source || 'storefront_earnings',
        test_mode_enabled: jdb.admin_settings.test_mode_enabled ?? true,
        withdrawal_fee_percent: Number(jdb.admin_settings.withdrawal_fee_percent) || 0.00,
        payment_gateway: jdb.admin_settings.payment_gateway || 'paystack',
        paystack_public_key: jdb.admin_settings.paystack_public_key || '',
        paystack_secret_key: jdb.admin_settings.paystack_secret_key || '',
        flutterwave_public_key: jdb.admin_settings.flutterwave_public_key || '',
        flutterwave_secret_key: jdb.admin_settings.flutterwave_secret_key || '',
        data_api_username: jdb.admin_settings.data_api_username || 'mock_username',
        data_api_key: jdb.admin_settings.data_api_key || 'mock_api_key',
        data_api_url: jdb.admin_settings.data_api_url || 'https://subandgain.com/api/data.php',
      };
    }
  },

  async updateSetting(key: string, value: string): Promise<boolean> {
    if (isPg && pool) {
      const check = await pool.query("SELECT id FROM admin_settings WHERE setting_key = $1", [key]);
      if (check.rowCount > 0) {
        await pool.query("UPDATE admin_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2", [value, key]);
      } else {
        await pool.query("INSERT INTO admin_settings (setting_key, setting_value) VALUES ($1, $2)", [key, value]);
      }
      return true;
    } else {
      const jdb = loadJsonDb();
      jdb.admin_settings[key] = value === 'true' ? true : (value === 'false' ? false : (isNaN(Number(value)) ? value : Number(value)));
      saveJsonDb(jdb);
      return true;
    }
  }
};
