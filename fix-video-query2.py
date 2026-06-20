with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

corrupt_warn = '\u00e2\u0161\xa0\u00ef\u00b8\x8f'
warn1 = "logger.warn('" + corrupt_warn + " Error searching videos by pgId:', e);"
warn2 = "logger.warn('" + corrupt_warn + " Error searching videos by Firebase UID:', e);"
print('warn1 in content:', warn1 in content)
print('warn2 in content:', warn2 in content)

old_fragment = (
    "          } catch (e) {\n"
    "          " + warn1 + "\n"
    "        }\n"
    "        \n"
    "        // Si no se encontraron por pgId, intentar por Firebase UID (para usuarios personales)\n"
    "        if (allVideos.length === 0 && firebaseUid !== pgId) {\n"
    "          try {\n"
    '            const q2 = query(videosRef, where("userId", "==", firebaseUid));\n'
    "            const snap2 = await getDocs(q2);\n"
    "            allVideos = [...snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }))];\n"
    "            logger.info(`\U0001f4ca Found ${snap2.size} videos by Firebase UID`);\n"
    "          } catch (e) {\n"
    "            " + warn2 + "\n"
    "          }\n"
    "        }"
)

print('old_fragment in content:', old_fragment in content)

if old_fragment in content:
    new_fragment = (
        "          } catch (e) {\n"
        "            logger.warn('\u26a0\ufe0f Error searching videos by pgId (number):', e);\n"
        "          }\n"
        "        }\n"
        "\n"
        "        // 2. Buscar por pgId como string\n"
        "        try {\n"
        '          const q2 = query(videosRef, where("userId", "==", pgIdStr));\n'
        "          const snap2 = await getDocs(q2);\n"
        "          mergeResults(snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })));\n"
        "          logger.info(`\U0001f4ca Found ${snap2.size} videos by pgId (string): ${pgIdStr}`);\n"
        "        } catch (e) {\n"
        "          logger.warn('\u26a0\ufe0f Error searching videos by pgId (string):', e);\n"
        "        }\n"
        "\n"
        "        // 3. Buscar por Clerk UID (usuarios reales autenticados con Clerk)\n"
        "        if (clerkId && clerkId !== pgIdStr) {\n"
        "          try {\n"
        '            const q3 = query(videosRef, where("userId", "==", clerkId));\n'
        "            const snap3 = await getDocs(q3);\n"
        "            mergeResults(snap3.docs.map(doc => ({ id: doc.id, ...doc.data() })));\n"
        "            logger.info(`\U0001f4ca Found ${snap3.size} videos by clerkId: ${clerkId}`);\n"
        "          } catch (e) {\n"
        "            logger.warn('\u26a0\ufe0f Error searching videos by clerkId:', e);\n"
        "          }\n"
        "        }\n"
        "\n"
        "        // 4. Buscar por Firebase UID si es distinto\n"
        "        if (firebaseUid && firebaseUid !== pgIdStr && firebaseUid !== clerkId) {\n"
        "          try {\n"
        '            const q4 = query(videosRef, where("userId", "==", firebaseUid));\n'
        "            const snap4 = await getDocs(q4);\n"
        "            mergeResults(snap4.docs.map(doc => ({ id: doc.id, ...doc.data() })));\n"
        "            logger.info(`\U0001f4ca Found ${snap4.size} videos by Firebase UID: ${firebaseUid}`);\n"
        "          } catch (e) {\n"
        "            logger.warn('\u26a0\ufe0f Error searching videos by Firebase UID:', e);\n"
        "          }\n"
        "        }"
    )
    content = content.replace(old_fragment, new_fragment, 1)
    with open('client/src/components/artist/artist-profile-card.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Video query patched")
