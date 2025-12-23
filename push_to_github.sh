#!/bin/bash

# Script para subir los 3 proyectos a GitHub
# INSTRUCCIONES: 
# 1. Primero crea los 3 repos en GitHub.com:
#    - the_synapsys-verifier
#    - the_synapsys-dashboard
#    - the_synapsys-website
# 2. Reemplaza TU_USUARIO con tu usuario de GitHub
# 3. Ejecuta: chmod +x push_to_github.sh
# 4. Ejecuta: ./push_to_github.sh

# CONFIGURA TU USUARIO AQUÍ:
GITHUB_USER="TU_USUARIO"  # <-- Cambia esto por tu usuario de GitHub

echo "🚀 Subiendo proyectos The Synapsys a GitHub..."
echo ""

# Backend - the_synapsys-verifier
echo "📦 1/3 - Subiendo Backend (the_synapsys-verifier)..."
cd the_synapsys-verifier
git branch -M main
git remote add origin git@github.com:${GITHUB_USER}/the_synapsys-verifier.git
git push -u origin main
cd ..
echo "✅ Backend subido"
echo ""

# Dashboard - the_synapsys-dashboard
echo "🎨 2/3 - Subiendo Dashboard (the_synapsys-dashboard)..."
cd the_synapsys-dashboard
git branch -M main
git remote add origin git@github.com:${GITHUB_USER}/the_synapsys-dashboard.git
git push -u origin main
cd ..
echo "✅ Dashboard subido"
echo ""

# Website - the_synapsys-website
echo "🌐 3/3 - Subiendo Website (the_synapsys-website)..."
cd the_synapsys-website
git branch -M main
git remote add origin git@github.com:${GITHUB_USER}/the_synapsys-website.git
git push -u origin main
cd ..
echo "✅ Website subido"
echo ""

echo "🎉 ¡Todos los proyectos se han subido exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Ve a github.com/${GITHUB_USER}/the_synapsys-verifier/actions"
echo "   2. Ve a github.com/${GITHUB_USER}/the_synapsys-dashboard/actions"
echo "   3. Ve a github.com/${GITHUB_USER}/the_synapsys-website/actions"
echo "   4. Verifica que los workflows de CI/CD pasen correctamente ✅"
