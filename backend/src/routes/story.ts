import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/authenticate.js';

// ══════════════════════════════════════════════════════════
// Story routes
// ══════════════════════════════════════════════════════════

const completeSchema = z.object({
  chapterId:  z.number().int().min(1).max(10),
  difficulty: z.enum(['calm', 'balanced', 'tempest']),
});

export default async function storyRoutes(fastify: FastifyInstance) {
  // ── POST /story/complete ───────────────────────────────────
  // Records a chapter completion on the user's story progress.
  // If all 3 chapters completed (any difficulty) sets fullClearDate.
  fastify.post('/story/complete', { preHandler: authenticate }, async (request, reply) => {
    const parsed = completeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }
    const { chapterId, difficulty } = parsed.data;
    const userId = request.userId;

    const user = await User.findById(userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    // Add completion entry
    user.story.completedChapters.push({
      chapterId,
      difficulty,
      completedAt: new Date(),
    });

    // Check full clear: all 3 chapters completed at least once
    const completedIds = new Set(user.story.completedChapters.map((c) => c.chapterId));
    if (completedIds.has(1) && completedIds.has(2) && completedIds.has(3) && !user.story.fullClearDate) {
      user.story.fullClearDate = new Date();
    }

    await user.save();

    return reply.status(200).send({
      ok: true,
      fullClear: !!user.story.fullClearDate,
      completedChapters: user.story.completedChapters.map((c) => ({
        chapterId:   c.chapterId,
        difficulty:  c.difficulty,
        completedAt: c.completedAt,
      })),
    });
  });
}
