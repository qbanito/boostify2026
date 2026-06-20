/**
 * Admin User Management Routes
 * 
 * Gestión de usuarios, roles y permisos desde el panel de administración
 * Solo accesible por administradores
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, userRoles, subscriptions } from '../db/schema';
import { eq, desc, sql, like, or, and, isNull, notInArray, inArray } from 'drizzle-orm';
import { isAdminEmail, ADMIN_EMAILS } from '../../shared/constants';
import { sendNotificationEmail } from '../services/brevo-email-service';
import { getAuth as getClerkAuth, clerkClient } from '@clerk/express';
import { requireAdmin } from '../middleware/require-admin';

const router = Router();

// Aplicar middleware a todas las rutas
router.use(requireAdmin);

/**
 * GET /api/admin/users - Obtener lista de usuarios con roles y suscripciones
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search = '', 
      role = '',
      subscription = '' 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Construir query base
    let query = db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        clerkId: users.clerkId,
        createdAt: users.createdAt,
        role: userRoles.role,
        permissions: userRoles.permissions,
        roleGrantedAt: userRoles.grantedAt,
        subscriptionPlan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        subscriptionEnd: subscriptions.currentPeriodEnd,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId));
    
    // Aplicar filtros
    const conditions: any[] = [];
    
    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`)
        )
      );
    }
    
    if (role) {
      // Use sql template for flexible role matching
      conditions.push(sql`${userRoles.role} = ${role}`);
    }
    
    if (subscription) {
      if (subscription === 'none') {
        conditions.push(isNull(subscriptions.plan));
      } else {
        // Use sql template for flexible plan matching
        conditions.push(sql`${subscriptions.plan} = ${subscription}`);
      }
    }
    
    // Ejecutar query con filtros
    const usersData = await query
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset(offset);
    
    // Contar total
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = totalResult[0]?.count || 0;
    
    res.json({
      success: true,
      users: usersData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Error fetching users' });
  }
});

/**
 * GET /api/admin/users/:id - Obtener detalle de usuario
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    const userData = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        clerkId: users.clerkId,
        createdAt: users.createdAt,
        role: userRoles.role,
        permissions: userRoles.permissions,
        roleGrantedAt: userRoles.grantedAt,
        roleGrantedBy: userRoles.grantedBy,
        subscriptionId: subscriptions.id,
        subscriptionPlan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        subscriptionStart: subscriptions.currentPeriodStart,
        subscriptionEnd: subscriptions.currentPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userData.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: userData[0]
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Error fetching user' });
  }
});

/**
 * POST /api/admin/users/:id/role - Asignar o actualizar rol de usuario
 */
router.post('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, permissions = [] } = req.body;
    
    console.log('[Admin Users] Saving role:', { userId, role, permissions });
    
    // Validar rol
    const validRoles = ['user', 'moderator', 'support', 'admin', 'tester'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      });
    }
    
    // Verificar que el usuario existe
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userExists.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Verificar si ya tiene un rol asignado
    const existingRole = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    if (existingRole.length > 0) {
      // Actualizar rol existente
      await db
        .update(userRoles)
        .set({
          role,
          permissions,
          updatedAt: new Date()
        })
        .where(eq(userRoles.userId, userId));
    } else {
      // Crear nuevo rol
      await db
        .insert(userRoles)
        .values({
          userId,
          role,
          permissions,
          grantedAt: new Date(),
          updatedAt: new Date()
        });
    }
    
    console.log('[Admin Users] Role saved successfully:', { userId, role });
    
    res.json({
      success: true,
      message: `Role '${role}' assigned to user ${userId}`
    });
    
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ success: false, error: 'Error assigning role' });
  }
});

/**
 * DELETE /api/admin/users/:id/role - Remover rol de usuario (volver a 'user')
 */
router.delete('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    await db
      .delete(userRoles)
      .where(eq(userRoles.userId, userId));
    
    res.json({
      success: true,
      message: `Role removed from user ${userId}, reverted to default 'user' role`
    });
    
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ success: false, error: 'Error removing role' });
  }
});

/**
 * POST /api/admin/users/:id/subscription - Asignar suscripción manualmente
 */
router.post('/users/:id/subscription', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan, status = 'active', durationDays = 30 } = req.body;
    
    // Validar plan
    const validPlans = ['free', 'artist', 'creator', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` 
      });
    }
    
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    
    // Verificar si ya tiene suscripción
    const existingSub = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    
    if (existingSub.length > 0) {
      // Actualizar suscripción existente
      await db
        .update(subscriptions)
        .set({
          plan,
          status,
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
          cancelAtPeriodEnd: false,
          updatedAt: now
        })
        .where(eq(subscriptions.userId, userId));
    } else {
      // Crear nueva suscripción
      await db
        .insert(subscriptions)
        .values({
          userId,
          plan,
          status,
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
          cancelAtPeriodEnd: false,
          interval: 'monthly',
          isTrial: false,
          createdAt: now,
          updatedAt: now
        });
    }
    
    res.json({
      success: true,
      message: `Subscription '${plan}' assigned to user ${userId} until ${endDate.toISOString()}`
    });
    
  } catch (error) {
    console.error('Error assigning subscription:', error);
    res.status(500).json({ success: false, error: 'Error assigning subscription' });
  }
});

/**
 * GET /api/admin/roles - Obtener estadísticas de roles
 */
router.get('/roles', async (req: Request, res: Response) => {
  try {
    // Contar usuarios por rol
    const roleStats = await db
      .select({
        role: userRoles.role,
        count: sql<number>`count(*)::int`
      })
      .from(userRoles)
      .groupBy(userRoles.role);
    
    // Contar usuarios sin rol asignado
    const usersWithoutRole = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .where(isNull(userRoles.id));
    
    // Total de usuarios
    const totalUsers = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    
    res.json({
      success: true,
      stats: {
        byRole: roleStats,
        usersWithoutRole: usersWithoutRole[0]?.count || 0,
        totalUsers: totalUsers[0]?.count || 0
      },
      availableRoles: [
        { value: 'user', label: 'User', description: 'Standard user access' },
        { value: 'moderator', label: 'Moderator', description: 'Can moderate content and users' },
        { value: 'support', label: 'Support', description: 'Customer support access' },
        { value: 'admin', label: 'Admin', description: 'Full administrative access' },
        { value: 'tester', label: 'Tester', description: 'Full platform access for testing all features (Premium + all tools)' }
      ],
      availablePermissions: [
        'manage_users',
        'manage_content',
        'manage_subscriptions',
        'view_analytics',
        'manage_artists',
        'manage_courses',
        'manage_payments',
        'view_accounting',
        'api_access',
        'export_data'
      ]
    });
    
  } catch (error) {
    console.error('Error fetching role stats:', error);
    res.status(500).json({ success: false, error: 'Error fetching role stats' });
  }
});

/**
 * GET /api/admin/subscriptions/stats - Estadísticas de suscripciones
 */
router.get('/subscriptions/stats', async (req: Request, res: Response) => {
  try {
    // Contar por plan
    const planStats = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: sql<number>`count(*)::int`
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status);
    
    // Total activas
    const activeCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));
    
    res.json({
      success: true,
      stats: {
        byPlanAndStatus: planStats,
        totalActive: activeCount[0]?.count || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({ success: false, error: 'Error fetching subscription stats' });
  }
});

/**
 * POST /api/admin/users - Crear nuevo usuario manualmente
 */
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, role = 'user' } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Verificar si el email ya existe
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }
    
    // Crear usuario
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({ id: users.id });
    
    // Si se especificó un rol diferente a 'user', asignarlo
    if (role && role !== 'user') {
      const validRoles = ['user', 'moderator', 'support', 'admin', 'tester'];
      if (validRoles.includes(role)) {
        await db
          .insert(userRoles)
          .values({
            userId: newUser.id,
            role: role as 'user' | 'moderator' | 'support' | 'admin',
            permissions: [],
            grantedAt: new Date(),
            updatedAt: new Date()
          });
      }
    }
    
    console.log('[Admin Users] User created:', { id: newUser.id, email, role });
    
    res.json({
      success: true,
      message: `User ${email} created successfully`,
      userId: newUser.id
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Error creating user' });
  }
});

/**
 * DELETE /api/admin/users/:id - Eliminar usuario y datos asociados
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    console.log('[Admin Users] Deleting user:', userId);
    
    // Verificar que el usuario existe
    const userExists = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userExists.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userEmail = userExists[0].email;
    
    // No permitir eliminar admins desde aquí (protección adicional)
    if (userEmail && isAdminEmail(userEmail)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot delete admin users from this interface' 
      });
    }
    
    // Eliminar rol del usuario si existe
    await db
      .delete(userRoles)
      .where(eq(userRoles.userId, userId));
    
    // Eliminar suscripción del usuario si existe
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, userId));
    
    // Eliminar usuario
    await db
      .delete(users)
      .where(eq(users.id, userId));
    
    console.log('[Admin Users] User deleted:', { userId, email: userEmail });
    
    res.json({
      success: true,
      message: `User ${userEmail} deleted successfully`
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Error deleting user' });
  }
});

/**
 * POST /api/admin/users/:id/invite - Send invite/welcome email to user
 */
router.post('/users/:id/invite', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { customMessage } = req.body;
    
    const userData = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userData.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userData[0];
    if (!user.email) {
      return res.status(400).json({ success: false, error: 'User has no email address' });
    }

    const platformUrl = process.env.BASE_URL || 'https://boostifymusic.com';
    const name = user.firstName || 'there';

    const inviteBody = customMessage
      ? `You've been invited to join the Boostify Music platform — the AI-powered music industry ecosystem.\n\n${customMessage}\n\nSign in with your email (${user.email}) using Google or email link authentication.`
      : `You've been invited to join the Boostify Music platform — the AI-powered music industry ecosystem. Create AI-powered music & videos, boost your social media presence, generate merch with AI designs, and monetize your music catalog.\n\nSign in with your email (${user.email}) using Google or email link authentication.`;

    const result = await sendNotificationEmail(
      user.email,
      '🎵 You\'re Invited to Boostify Music!',
      `Welcome to Boostify Music, ${name}!`,
      inviteBody,
      'Get Started →',
      platformUrl
    );

    if (result.success) {
      res.json({ success: true, message: `Invitation email sent to ${user.email}` });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to send email' });
    }
    
  } catch (error) {
    console.error('Error sending invite:', error);
    res.status(500).json({ success: false, error: 'Error sending invitation email' });
  }
});

/**
 * POST /api/admin/users/bulk-invite - Send invite emails to multiple users
 */
router.post('/users/bulk-invite', async (req: Request, res: Response) => {
  try {
    const { userIds, customMessage } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'userIds array is required' });
    }

    if (userIds.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 users per batch' });
    }
    
    const usersData = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(inArray(users.id, userIds));
    
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const user of usersData) {
      if (!user.email) { failed++; continue; }
      
      const platformUrl = process.env.BASE_URL || 'https://boostifymusic.com';
      const name = user.firstName || 'there';

      const bulkBody = customMessage
        ? `You've been invited to Boostify Music — the AI-powered music platform.\n\n${customMessage}`
        : `You've been invited to Boostify Music — the AI-powered music platform. Create music, boost your social presence, and grow your fan base with AI.`;

      const result = await sendNotificationEmail(
        user.email,
        '🎵 You\'re Invited to Boostify Music!',
        `Welcome to Boostify Music, ${name}!`,
        bulkBody,
        'Get Started →',
        platformUrl
      );
      
      if (result.success) { sent++; } 
      else { failed++; errors.push(`${user.email}: ${result.error}`); }
    }
    
    res.json({
      success: true,
      message: `Sent ${sent} invitations, ${failed} failed`,
      sent,
      failed,
      errors: errors.slice(0, 5),
    });
    
  } catch (error) {
    console.error('Error bulk inviting:', error);
    res.status(500).json({ success: false, error: 'Error sending bulk invitations' });
  }
});

/**
 * POST /api/admin/users/cleanup-test - Remove all test/non-admin users with no Clerk ID
 */
router.post('/users/cleanup-test', async (req: Request, res: Response) => {
  try {
    const { confirmDelete = false, preserveEmails = [] } = req.body;
    
    // Always preserve admin emails
    const protectedEmails = [...ADMIN_EMAILS.map(e => e.toLowerCase()), ...preserveEmails.map((e: string) => e.toLowerCase())];
    
    // Find test users (no clerkId AND not admin)
    const testUsers = await db
      .select({ id: users.id, email: users.email, clerkId: users.clerkId, firstName: users.firstName })
      .from(users)
      .where(
        and(
          isNull(users.clerkId),
          sql`LOWER(${users.email}) NOT IN (${sql.join(protectedEmails.map(e => sql`${e}`), sql`, `)})`
        )
      );
    
    if (!confirmDelete) {
      // Preview mode — show what would be deleted
      return res.json({
        success: true,
        preview: true,
        count: testUsers.length,
        users: testUsers.map(u => ({ id: u.id, email: u.email, firstName: u.firstName })),
        message: `Found ${testUsers.length} test users to clean up. Send confirmDelete: true to proceed.`
      });
    }
    
    // Delete associated data first, then users
    const idsToDelete = testUsers.map(u => u.id);
    if (idsToDelete.length > 0) {
      await db.delete(userRoles).where(inArray(userRoles.userId, idsToDelete));
      await db.delete(subscriptions).where(inArray(subscriptions.userId, idsToDelete));
      await db.delete(users).where(inArray(users.id, idsToDelete));
    }
    
    console.log(`[Admin Users] Cleaned up ${idsToDelete.length} test users`);
    
    res.json({
      success: true,
      preview: false,
      deletedCount: idsToDelete.length,
      message: `Successfully removed ${idsToDelete.length} test users. Admin accounts preserved.`
    });
    
  } catch (error) {
    console.error('Error cleaning test users:', error);
    res.status(500).json({ success: false, error: 'Error cleaning up test users' });
  }
});

/**
 * POST /api/admin/users/:id/platform-access - Grant/revoke specific platform area access
 */
router.post('/users/:id/platform-access', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { areas } = req.body; // Array of platform area keys
    
    if (!Array.isArray(areas)) {
      return res.status(400).json({ success: false, error: 'areas must be an array' });
    }
    
    // Valid platform areas
    const validAreas = [
      'dashboard', 'artist_studio', 'music_creation', 'video_creation',
      'merch_store', 'social_boost', 'ig_boost', 'youtube_boost', 'spotify_boost',
      'analytics', 'monetization', 'courses', 'crowdfunding', 'boostiswap',
      'investor_portal', 'admin_panel', 'api_access', 'export_tools'
    ];
    
    const invalidAreas = areas.filter((a: string) => !validAreas.includes(a));
    if (invalidAreas.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid areas: ${invalidAreas.join(', ')}`,
        validAreas 
      });
    }
    
    // Check existing role
    const existingRole = await db
      .select({ id: userRoles.id, role: userRoles.role, permissions: userRoles.permissions })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    // Merge platform areas into permissions (prefix with "area:")
    const areaPermissions = areas.map((a: string) => `area:${a}`);
    
    if (existingRole.length > 0) {
      const currentPerms = (existingRole[0].permissions as string[]) || [];
      // Remove all old area: permissions and add new ones
      const nonAreaPerms = currentPerms.filter(p => !p.startsWith('area:'));
      const merged = [...nonAreaPerms, ...areaPermissions];
      
      await db.update(userRoles)
        .set({ permissions: merged, updatedAt: new Date() })
        .where(eq(userRoles.userId, userId));
    } else {
      await db.insert(userRoles).values({
        userId,
        role: 'user',
        permissions: areaPermissions,
        grantedAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    res.json({
      success: true,
      message: `Platform access updated: ${areas.length} areas granted to user ${userId}`,
      areas,
    });
    
  } catch (error) {
    console.error('Error updating platform access:', error);
    res.status(500).json({ success: false, error: 'Error updating platform access' });
  }
});

/**
 * GET /api/admin/users/:id/platform-access - Get user's platform area access
 */
router.get('/users/:id/platform-access', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    const roleData = await db
      .select({ permissions: userRoles.permissions, role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    const permissions = (roleData[0]?.permissions as string[]) || [];
    const areas = permissions.filter(p => p.startsWith('area:')).map(p => p.replace('area:', ''));
    const role = roleData[0]?.role || 'user';
    
    // Admins and testers get all areas
    const allAreas = [
      'dashboard', 'artist_studio', 'music_creation', 'video_creation',
      'merch_store', 'social_boost', 'ig_boost', 'youtube_boost', 'spotify_boost',
      'analytics', 'monetization', 'courses', 'crowdfunding', 'boostiswap',
      'investor_portal', 'admin_panel', 'api_access', 'export_tools'
    ];
    
    const effectiveAreas = (role === 'admin' || role === 'tester') ? allAreas : areas;
    
    res.json({
      success: true,
      role,
      areas: effectiveAreas,
      allAreas,
    });
    
  } catch (error) {
    console.error('Error fetching platform access:', error);
    res.status(500).json({ success: false, error: 'Error fetching platform access' });
  }
});

export default router;
