import { APIError } from 'payload';
import type { CollectionConfig } from 'payload';
import { isAdministrator } from './access';

// Infrastructure-only authentication. Editor roles and business permissions belong to T07.
export const Admins: CollectionConfig = {
  slug: 'admins',
  auth: true,
  admin: { useAsTitle: 'email' },
  access: {
    admin: ({ req }) => req.user?.collection === 'admins',
    create: isAdministrator,
    read: isAdministrator,
    update: isAdministrator,
    delete: isAdministrator,
  },
  fields: [
    {
      name: 'role',
      label: '角色',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: '管理员', value: 'admin' },
        { label: '内容编辑', value: 'editor' },
      ],
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        if (operation === 'create' && !req.user) {
          const existing = await req.payload.count({
            collection: 'admins',
            req,
            overrideAccess: true,
          });
          if (existing.totalDocs !== 0) throw new APIError('需要管理员权限。', 403);
          data.role = 'admin';
        }
        if (
          operation === 'update' &&
          originalDoc?.id === req.user?.id &&
          data.role &&
          data.role !== 'admin'
        )
          throw new APIError('不能降低当前登录管理员自己的权限。', 400);
        return data;
      },
    ],
    beforeDelete: [
      ({ id, req }) => {
        if (id === req.user?.id) throw new APIError('不能删除当前登录账号。', 400);
      },
    ],
  },
};
