import { query } from '../config/database';

export type AdminActionType =
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_activate'
  | 'user_deactivate'
  | 'config_update'
  | 'config_test'
  | 'library_sync'
  | 'library_update'
  | 'library_visibility'
  | 'system_stats_view'
  | 'activity_logs_view'
  | 'r2_config_update'
  | 'r2_upload'
  | 'r2_rename'
  | 'r2_move'
  | 'r2_delete'
  | 'cache_clear';

export interface AdminAction {
  id: string;
  adminId: string;
  actionType: AdminActionType;
  targetId?: string;
  details?: any;
  createdAt: Date;
}

export const logAction = async (
  adminId: string,
  actionType: AdminActionType,
  targetId?: string,
  details?: any
): Promise<AdminAction | null> => {
  try {
    const result = await query(
      `INSERT INTO admin_actions (admin_id, action_type, target_id, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [adminId, actionType, targetId || null, details ? JSON.stringify(details) : null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      adminId: row.admin_id,
      actionType: row.action_type,
      targetId: row.target_id,
      details: row.details ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details) : undefined,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('Error logging admin action:', error);
    return null;
  }
};

export const getActionLogs = async (
  limit: number = 100,
  offset: number = 0,
  adminId?: string
): Promise<AdminAction[]> => {
  try {
    let queryStr = `SELECT * FROM admin_actions`;
    const params: any[] = [];
    let paramIndex = 1;

    if (adminId) {
      queryStr += ` WHERE admin_id = $${paramIndex++}`;
      params.push(adminId);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    return result.rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      actionType: row.action_type,
      targetId: row.target_id,
      details: row.details ? (typeof row.details === 'string' ? JSON.parse(row.details) : row.details) : undefined,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting action logs:', error);
    return [];
  }
};

