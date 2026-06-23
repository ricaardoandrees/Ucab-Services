// Uso: router.get('/ruta', verificarToken, autorizar('admin','director'), handler)
module.exports = function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Roles permitidos: ${rolesPermitidos.join(', ')}` 
      });
    }
    next();
  };
};