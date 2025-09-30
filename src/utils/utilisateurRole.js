import Utilisateur from "../models/Utilisateur.js";

// ✅ Ajoute un rôle dans la liste des rôles si absent
export const addRoleToUser = async (userId, role) => {
  if (!userId) return;
  await Utilisateur.findByIdAndUpdate(userId, {
    $addToSet: { roles: role } // évite les doublons
  });
};

// ✅ Retire un rôle si l'utilisateur n'en a plus besoin
export const removeRoleFromUserIfUnused = async (userId, role, model, field = 'utilisateur') => {
  if (!userId) return;

  const stillHasRole = await model.exists({ [field]: userId });
  if (!stillHasRole) {
    await Utilisateur.findByIdAndUpdate(userId, {
      $pull: { roles: role }
    });
  }
};
