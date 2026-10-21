import { Router } from 'express';
import { requireAuth, requireUserManager } from '../../src/middleware/auth.js';
import { userManagementController } from '../controllers/UserManagementController.js';

const router = Router();

router.get('/users', requireAuth, (req, res) => userManagementController.listUsers(req, res));
router.post('/users', requireAuth, requireUserManager, (req, res) =>
  userManagementController.createUser(req, res)
);
router.put('/users/:id', requireAuth, requireUserManager, (req, res) =>
  userManagementController.updateUser(req, res)
);
router.delete('/users/:id', requireAuth, requireUserManager, (req, res) =>
  userManagementController.deleteUser(req, res)
);
router.post('/users/:id/impersonate', requireAuth, requireUserManager, (req, res) =>
  userManagementController.impersonateUser(req, res)
);

export default router;
