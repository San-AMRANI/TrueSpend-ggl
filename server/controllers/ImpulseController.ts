import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { impulseService } from '../services/ImpulseService.js';

export class ImpulseController {
  async getItems(req: AuthRequest, res: Response) {
    try {
      const items = await impulseService.getItemsForUser(req.dbUser.id);
      res.json(items);
    } catch (e: any) {
      console.error('Error in getItems:', e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async createItem(req: AuthRequest, res: Response) {
    try {
      const result = await impulseService.createItem(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('Error in createItem:', e);
      res.status(400).json({ error: e.message || 'Unable to create impulse item' });
    }
  }

  async updateItem(req: AuthRequest, res: Response) {
    try {
      const result = await impulseService.updateItem(req.dbUser.id, req.params.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error('Error in updateItem:', e);
      const status = e.message === 'Impulse item not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to update impulse item' });
    }
  }

  async deleteItem(req: AuthRequest, res: Response) {
    try {
      const result = await impulseService.deleteItem(req.dbUser.id, req.params.id);
      res.status(200).json(result);
    } catch (e: any) {
      console.error('Error in deleteItem:', e);
      const status = e.message === 'Impulse item not found' ? 404 : 500;
      res.status(status).json({ error: e.message || 'Unable to delete impulse item' });
    }
  }

  async resolveDecision(req: AuthRequest, res: Response) {
    try {
      const result = await impulseService.resolveDecision(req.dbUser.id, req.params.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error('Error in resolveDecision:', e);
      const status = e.message === 'Impulse item not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to resolve impulse decision' });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await impulseService.getStats(req.dbUser.id);
      res.json(stats);
    } catch (e: any) {
      console.error('Error in getStats:', e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const impulseController = new ImpulseController();
