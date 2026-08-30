export default (plugin: any) => {
  const originalCallback = plugin.controllers.auth.callback;
  const originalRegister = plugin.controllers.auth.register;
  const originalMe = plugin.controllers.user.me;

  // 1. Override login callback to guarantee populated role
  plugin.controllers.auth.callback = async (ctx: any) => {
    await originalCallback(ctx);

    if (ctx.body && ctx.body.user && ctx.body.user.id) {
      const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: ctx.body.user.id },
        populate: ['role'],
      });

      if (userWithRole && userWithRole.role) {
        ctx.body.user.role = {
          id: userWithRole.role.id,
          name: userWithRole.role.name,
          type: userWithRole.role.type || userWithRole.role.name.toLowerCase().replace(/\s+/g, '_'),
          description: userWithRole.role.description,
        };
      }
    }
  };

  // 2. Override register to ensure default Student role and return populated role
  plugin.controllers.auth.register = async (ctx: any) => {
    await originalRegister(ctx);

    if (ctx.body && ctx.body.user && ctx.body.user.id) {
      // Find Student role
      const studentRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { name: 'Student' },
      });

      if (studentRole) {
        await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: ctx.body.user.id },
          data: { role: studentRole.id },
        });
      }

      const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: ctx.body.user.id },
        populate: ['role'],
      });

      if (userWithRole && userWithRole.role) {
        ctx.body.user.role = {
          id: userWithRole.role.id,
          name: userWithRole.role.name,
          type: userWithRole.role.type || userWithRole.role.name.toLowerCase().replace(/\s+/g, '_'),
          description: userWithRole.role.description,
        };
      }
    }
  };

  // 3. Override /api/users/me to return populated role
  plugin.controllers.user.me = async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: ['role'],
    });

    if (!userWithRole) {
      return ctx.notFound();
    }

    ctx.body = {
      id: userWithRole.id,
      documentId: userWithRole.documentId,
      username: userWithRole.username,
      email: userWithRole.email,
      confirmed: userWithRole.confirmed,
      blocked: userWithRole.blocked,
      role: userWithRole.role
        ? {
            id: userWithRole.role.id,
            name: userWithRole.role.name,
            type: userWithRole.role.type || userWithRole.role.name.toLowerCase().replace(/\s+/g, '_'),
            description: userWithRole.role.description,
          }
        : null,
    };
  };

  return plugin;
};
