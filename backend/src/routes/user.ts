import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { User } from '../models/User.js';
import { saveSaveSchema } from '../schemas/user.schema.js';

export default async function userRoutes(fastify: FastifyInstance) {
  // GET /user/me — returns current user's full profile and save data.
  // The response is the authoritative source for the Garden dashboard.
  fastify.get('/user/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.userId).select('-passwordHash');
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return reply.send({
      // Identity
      userId: String(user._id),
      username: user.username,
      createdAt: user.createdAt,
      // Core save
      seeds:         user.seeds,
      highScore:     user.highScore,
      totalRuns:     user.totalRuns,
      up:            user.up,
      weapons:       user.weapons,
      abilities:     user.abilities,
      activeWeapon:  user.activeWeapon,
      activeAbility: user.activeAbility,
      runHistory:    user.runHistory,
      // Extended
      stats:             user.stats,
      profile:           user.profile,
      loadout:           user.loadout,
      inventory:         user.inventory,
      pity:              user.pity,
      ranked:            user.ranked,
      seasonProgress:    user.seasonProgress,
      challengeProgress: user.challengeProgress,
      friends:           user.friends,
      story:             user.story,
      prestige:          user.prestige,
    });
  });

  // PATCH /user/save — atomically writes the core game save state.
  // Called on game-over and on upgrade/weapon/ability purchases.
  // Only writes the fields defined in saveSaveSchema — extended data
  // (ranked, stats, profile, etc.) has its own dedicated endpoints.
  fastify.patch('/user/save', { preHandler: authenticate }, async (request, reply) => {
    const parsed = saveSaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const update = parsed.data;
    const user = await User.findByIdAndUpdate(
      request.userId,
      {
        $set: {
          seeds:         update.seeds,
          highScore:     update.highScore,
          totalRuns:     update.totalRuns,
          up:            update.up,
          weapons:       update.weapons,
          abilities:     update.abilities,
          activeWeapon:  update.activeWeapon,
          activeAbility: update.activeAbility,
          ...(update.runHistory ? { runHistory: update.runHistory } : {}),
          ...(update.inventory ? {
            inventory: update.inventory.map((item) => ({
              id: item.id,
              category: item.type,
              rarity: item.rarity,
              source: 'client-sync',
            })),
          } : {}),
          ...(typeof update.pityCount === 'number'
            ? { 'pity.pullsSinceLastLegendary': update.pityCount }
            : {}),
          ...(update.profile ? {
            'profile.avatarId': update.profile.avatar,
            'profile.frameId': update.profile.frame,
            'profile.bannerId': update.profile.banner,
          } : {}),
        },
      },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send({ ok: true });
  });
}
