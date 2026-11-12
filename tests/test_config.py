import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from rescue.config import settings


class ConfigTest(unittest.TestCase):
    def test_only_local_configuration_and_shell_are_loaded(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory)
            project = parent / 'payout_rescue'
            project.mkdir()
            (parent / '.env').write_text('PARENT_ONLY=not-project-config\n')
            (project / '.env').write_text('LOCAL_ONLY=local\nOVERRIDE=file\n')
            with patch('rescue.config.ROOT', project), patch.dict(
                    os.environ, {'OVERRIDE': 'shell'}, clear=True):
                self.assertEqual(settings(), {'LOCAL_ONLY': 'local', 'OVERRIDE': 'shell'})

    def test_missing_local_file_uses_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch('rescue.config.ROOT', Path(directory)), patch.dict(
                    os.environ, {'LOCAL_ONLY': 'shell'}, clear=True):
                self.assertEqual(settings(), {'LOCAL_ONLY': 'shell'})
