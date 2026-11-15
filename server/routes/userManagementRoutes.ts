import { Router } from 'express';
import { requireAuth, requireUserManager } from '../../src/middleware/auth.js';
import { userManagementController } from '../controllers/UserManagementController.js';

const router = Router();

router.get('/users', requireAuth, requireUserManager, (req, res) =>
  userManagementController.listUsers(req as any, res)
);
router.get('/users/ownership-inventory', requireAuth, requireUserManager, (req, res) =>
  userManagementController.getOwnershipInventory(req as any, res)
);
router.post('/users', requireAuth, requireUserManager, (req, res) =>
  userManagementController.createUser(req as any, res)
);
router.put('/users/:id', requireAuth, requireUserManager, (req, res) =>
  userManagementController.updateUser(req as any, res)
);
router.delete('/users/:id', requireAuth, requireUserManager, (req, res) =>
  userManagementController.deleteUser(req as any, res)
);
router.post('/users/:id/impersonate', requireAuth, requireUserManager, (req, res) =>
  userManagementController.impersonateUser(req as any, res)
);

export default router;
