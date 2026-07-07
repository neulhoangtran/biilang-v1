export const sanitizeMobileUser = (user: any) => {
  if (!user) return null;

  const phoneNumber =
    user.PhoneNumber ||
    user.phoneNumber ||
    user.phone_number ||
    user.username ||
    '';

  const fullName = [user.LastName, user.FirstName]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const customName =
    user.CustomName ||
    (phoneNumber && fullName
      ? `${phoneNumber} - ${fullName}`
      : phoneNumber || fullName || '');

  return {
    id: user.id,
    documentId: user.documentId,

    username: user.username,
    email: user.email,
    PhoneNumber: phoneNumber,

    FirstName: user.FirstName,
    LastName: user.LastName,
    CustomName: customName,

    DateOfBirth: user.DateOfBirth,
    Sex: user.Sex,

    confirmed: user.confirmed,
    blocked: user.blocked,

    MarkDelete: user.MarkDelete ?? false,
    MarkDeleteDate: user.MarkDeleteDate ?? null,

    IsFirstRegister: user.IsFirstRegister ?? false,
    ExpiredFirstRegisterVoucher:
      user.ExpiredFirstRegisterVoucher ?? null,

    wishlist_product_ids:
      Array.isArray(user.wishlist_product_ids)
        ? user.wishlist_product_ids
        : [],

    Branch: user.Branch
      ? {
          id: user.Branch.id,
          documentId: user.Branch.documentId,

          Name: user.Branch.Name,
          Slug: user.Branch.Slug,
          Area: user.Branch.Area,

          Address: user.Branch.Address,
          Phone: user.Branch.Phone,

          Zalo: user.Branch.Zalo,
          Messenger: user.Branch.Messenger,
          MessengerWeb: user.Branch.MessengerWeb,
        }
      : null,

    Avatar: user.Avatar
      ? {
          id: user.Avatar.id,
          documentId: user.Avatar.documentId,

          url: user.Avatar.url,
          formats: user.Avatar.formats,
        }
      : null,

    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          type: user.role.type,
        }
      : null,
  };
};